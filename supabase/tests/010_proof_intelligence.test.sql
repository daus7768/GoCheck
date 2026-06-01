-- SQL-level tests for migration 010
-- Run via Supabase dashboard SQL editor against a freshly-applied migration.

\set QUIET on
SET client_min_messages TO WARNING;

-- ─── Fixtures: synthetic organizer, bill, participant ─────────────────────────
DO $$
DECLARE
  v_organizer_id UUID;
  v_bill_id      UUID;
  v_pid          UUID;
  v_token        UUID;
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
  VALUES (gen_random_uuid(), 'organizer-' || gen_random_uuid()::text || '@test.com', '', NOW(), NOW(), NOW(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  RETURNING id INTO v_organizer_id;

  INSERT INTO public.user_profiles (id, display_name)
  VALUES (v_organizer_id, 'Test Organizer L010');

  INSERT INTO public.bills (organizer_id, title, total_amount, currency, due_date, share_link, status)
  VALUES (v_organizer_id, 'Layer A Test Bill', 50, 'MYR', NOW() + INTERVAL '7 days',
          'test-share-' || gen_random_uuid()::text, 'active')
  RETURNING id INTO v_bill_id;

  INSERT INTO public.participants (bill_id, name, amount)
  VALUES (v_bill_id, 'Layer A Tester', 50)
  RETURNING id, access_token INTO v_pid, v_token;

  CREATE TEMP TABLE _fix010 (key TEXT PRIMARY KEY, val TEXT);
  INSERT INTO _fix010 VALUES
    ('pid',   v_pid::text),
    ('token', v_token::text);

  RAISE NOTICE 'Migration 010 fixtures: pid=%, token=%', v_pid, v_token;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.assert010(p_cond BOOLEAN, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_cond THEN RAISE EXCEPTION 'ASSERTION FAILED: %', p_msg; END IF;
  RAISE NOTICE 'PASS: %', p_msg;
END $$;

-- ─── Test: get_participant_view includes proofExtracted + proofSummary keys ───
DO $$
DECLARE
  v_token UUID;
  v_view  json;
BEGIN
  SELECT val::uuid INTO v_token FROM _fix010 WHERE key = 'token';

  v_view := public.get_participant_view(v_token);
  PERFORM pg_temp.assert010(v_view IS NOT NULL, 'get_participant_view returns non-null');
  PERFORM pg_temp.assert010(v_view->'participant' ? 'proofExtracted', 'proofExtracted key present in participant');
  PERFORM pg_temp.assert010(v_view->'participant' ? 'proofSummary',   'proofSummary key present in participant');
  PERFORM pg_temp.assert010(v_view->'participant'->>'proofSummary' IS NULL, 'proofSummary is null when unset');
END $$;

-- ─── Test: clear_payment_proof — happy path ───────────────────────────────────
DO $$
DECLARE
  v_pid   UUID;
  v_token UUID;
  v_res   json;
  v_url   TEXT;
BEGIN
  SELECT val::uuid INTO v_pid   FROM _fix010 WHERE key = 'pid';
  SELECT val::uuid INTO v_token FROM _fix010 WHERE key = 'token';

  -- Seed: set all three proof fields directly
  UPDATE participants
  SET proof_url='payment-proofs/x/proof.jpg',
      proof_extracted='{"amount":50}'::jsonb,
      proof_summary='seed summary'
  WHERE id = v_pid;

  v_res := public.clear_payment_proof(v_token);
  PERFORM pg_temp.assert010((v_res->>'cleared')::boolean = true, 'clear returns cleared=true');

  SELECT proof_url INTO v_url FROM participants WHERE id = v_pid;
  PERFORM pg_temp.assert010(v_url IS NULL, 'proof_url nulled after clear');

  SELECT proof_summary INTO v_url FROM participants WHERE id = v_pid;
  PERFORM pg_temp.assert010(v_url IS NULL, 'proof_summary nulled after clear');
END $$;

-- ─── Test: clear_payment_proof — invalid token raises ─────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.clear_payment_proof(gen_random_uuid());
    PERFORM pg_temp.assert010(FALSE, 'clear with invalid token should raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.assert010(TRUE, 'invalid token raises');
  END;
END $$;

DO $$ BEGIN RAISE NOTICE '── All migration 010 tests passed ──'; END $$;
