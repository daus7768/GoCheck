-- Migration 010: Layer A — proof intelligence (schema only; get_participant_view
-- redefinition is appended in the next task).

-- ─── participants: new columns ────────────────────────────────────────────────
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS proof_extracted JSONB,
  ADD COLUMN IF NOT EXISTS proof_summary   TEXT;

-- ─── private storage bucket for payment proofs ────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- ─── RPC: clear_payment_proof ─────────────────────────────────────────────────
-- Anyone with the participant token can clear their own proof. The storage
-- object is intentionally NOT deleted here — Layer D adds the cleanup job.
-- Overwrites of the deterministic path payment-proofs/{pid}/proof.{ext} are
-- safe.
CREATE OR REPLACE FUNCTION public.clear_payment_proof(p_token UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid UUID;
BEGIN
  SELECT id INTO v_pid
  FROM participants
  WHERE access_token = p_token;

  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Invalid participant token';
  END IF;

  UPDATE participants
  SET proof_url       = NULL,
      proof_extracted = NULL,
      proof_summary   = NULL
  WHERE id = v_pid;

  RETURN json_build_object('id', v_pid, 'cleared', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_payment_proof(UUID) TO anon, authenticated;

-- ─── Redefine get_participant_view to include proof_extracted + proof_summary ─
-- This is additive and idempotent (CREATE OR REPLACE). The previous definition
-- from migration 008 is dropped via REPLACE.
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
      'proofExtracted',  p.proof_extracted,
      'proofSummary',    p.proof_summary,
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

  RETURN v_result;
END;
$$;
