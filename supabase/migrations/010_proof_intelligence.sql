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
