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

CREATE INDEX IF NOT EXISTS idx_participants_access_token   ON public.participants(access_token);
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
