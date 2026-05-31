-- Migration 008: Per-participant payment flow (core)
-- Adds: access_token, payment_status, supporting columns
-- Backfills: existing rows get tokens + status derived from is_paid
-- Maintains: legacy is_paid/paid_at in sync via trigger

-- ─── participants: new columns ────────────────────────────────────────────────
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS access_token     UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS payment_status   TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','confirmed','rejected')),
  ADD COLUMN IF NOT EXISTS proof_url        TEXT,
  ADD COLUMN IF NOT EXISTS submitted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason  TEXT;

CREATE INDEX IF NOT EXISTS idx_participants_payment_status ON public.participants(payment_status);

-- ─── Backfill: tokens + statuses for existing rows ────────────────────────────
UPDATE public.participants
SET access_token = gen_random_uuid()
WHERE access_token IS NULL;

UPDATE public.participants
SET payment_status = 'confirmed',
    confirmed_at  = COALESCE(paid_at, NOW())
WHERE is_paid = TRUE AND payment_status = 'unpaid';

-- ─── Legacy sync trigger: keep is_paid/paid_at consistent with payment_status ─
-- NOTE: trigger creation MUST be after the backfill UPDATEs above. Otherwise the
-- trigger would null out paid_at while we're trying to set confirmed_at from it.
CREATE OR REPLACE FUNCTION public.sync_legacy_paid_fields()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.payment_status = 'confirmed' THEN
    NEW.is_paid := TRUE;
    NEW.paid_at := COALESCE(NEW.confirmed_at, NOW());
  ELSE
    NEW.is_paid := FALSE;
    NEW.paid_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_legacy_paid ON public.participants;
CREATE TRIGGER trg_sync_legacy_paid
  BEFORE INSERT OR UPDATE OF payment_status, confirmed_at ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.sync_legacy_paid_fields();

-- ─── Override migration 006's mark_participant_paid so legacy share links also
--     write payment_status. The trigger above then syncs is_paid/paid_at.
CREATE OR REPLACE FUNCTION public.mark_participant_paid(
  p_share_code     TEXT,
  p_participant_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_result  json;
BEGIN
  SELECT bill_id INTO v_bill_id
  FROM share_links
  WHERE code = p_share_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_bill_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired share link';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM participants
    WHERE id = p_participant_id AND bill_id = v_bill_id
  ) THEN
    RAISE EXCEPTION 'Participant not found for this bill';
  END IF;

  UPDATE participants
  SET payment_status = 'confirmed',
      confirmed_at   = now()
  WHERE id = p_participant_id
    AND bill_id = v_bill_id
    AND payment_status <> 'confirmed'
  RETURNING json_build_object(
    'id',            id,
    'bill_id',       bill_id,
    'paymentStatus', payment_status,
    'confirmedAt',   confirmed_at
  ) INTO v_result;

  RETURN COALESCE(v_result, '{"already_paid": true}'::json);
END;
$$;

-- ─── RPC: get_participant_view ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_participant_view(p_token UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'participant', json_build_object(
      'id',              p.id,
      'name',            p.name,
      'amount',          p.amount,
      'paymentStatus',   p.payment_status,
      'proofUrl',        p.proof_url,
      'submittedAt',     p.submitted_at,
      'confirmedAt',     p.confirmed_at,
      'rejectedReason',  p.rejected_reason
    ),
    'bill', json_build_object(
      'id',              b.id,
      'title',           b.title,
      'description',     b.description,
      'currency',        b.currency,
      'dueDate',         b.due_date,
      'status',          b.status,
      'invoiceNumber',   b.invoice_number,
      'paymentMethod',   b.payment_method,
      'paymentDetails',  b.payment_details
    ),
    'organizer', json_build_object(
      'displayName', COALESCE(up.display_name, 'Organizer'),
      'avatarUrl',   up.avatar_url
    ),
    'socialProof', json_build_object(
      'paidCount',  (SELECT COUNT(*) FROM participants WHERE bill_id = b.id AND payment_status = 'confirmed'),
      'totalCount', (SELECT COUNT(*) FROM participants WHERE bill_id = b.id)
    )
  ) INTO v_result
  FROM participants p
  JOIN bills b ON b.id = p.bill_id
  LEFT JOIN user_profiles up ON up.id = b.organizer_id
  WHERE p.access_token = p_token;

  RETURN v_result;  -- NULL if token not found
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_participant_view(UUID) TO anon, authenticated;

-- ─── RPC: submit_payment ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_token     UUID,
  p_proof_url TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL  -- accepted but ignored in core (message thread is Layer 2)
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid     UUID;
  v_status  TEXT;
  v_result  json;
BEGIN
  SELECT id, payment_status INTO v_pid, v_status
  FROM participants
  WHERE access_token = p_token;

  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Invalid participant token';
  END IF;

  -- Idempotent: already confirmed → return marker, do nothing
  IF v_status = 'confirmed' THEN
    RETURN json_build_object('already_confirmed', true);
  END IF;

  -- Allowed transitions: unpaid → pending; rejected → pending; pending → pending (re-submit)
  UPDATE participants
  SET payment_status  = 'pending',
      submitted_at    = NOW(),
      proof_url       = COALESCE(p_proof_url, proof_url),
      rejected_reason = NULL
  WHERE id = v_pid
  RETURNING json_build_object(
    'id',            id,
    'paymentStatus', payment_status,
    'submittedAt',   submitted_at
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment(UUID, TEXT, TEXT) TO anon, authenticated;

-- ─── RPC: confirm_payment (organizer-side, RLS-gated) ─────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_payment(p_participant_id UUID)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  -- RLS on participants enforces organizer ownership; this UPDATE will return 0 rows for non-organizers
  UPDATE participants
  SET payment_status  = 'confirmed',
      confirmed_at    = NOW(),
      rejected_reason = NULL
  WHERE id = p_participant_id
    AND payment_status IN ('pending', 'unpaid', 'rejected')
  RETURNING json_build_object(
    'id',            id,
    'paymentStatus', payment_status,
    'confirmedAt',   confirmed_at
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Participant not found or not authorized';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_payment(UUID) TO authenticated;

-- ─── RPC: reject_payment (organizer-side, RLS-gated) ──────────────────────────
CREATE OR REPLACE FUNCTION public.reject_payment(
  p_participant_id UUID,
  p_reason         TEXT
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'Reason required';
  END IF;

  UPDATE participants
  SET payment_status  = 'rejected',
      rejected_reason = p_reason,
      confirmed_at    = NULL
  WHERE id = p_participant_id
    AND payment_status IN ('pending', 'confirmed')
  RETURNING json_build_object(
    'id',             id,
    'paymentStatus',  payment_status,
    'rejectedReason', rejected_reason
  ) INTO v_result;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Participant not found or not authorized';
  END IF;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_payment(UUID, TEXT) TO authenticated;
