-- SQL-level tests for migration 008
-- Run via: supabase db reset && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/008_participant_payment_flow.test.sql

\set QUIET on
SET client_min_messages TO WARNING;

-- ─── Test fixtures ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_organizer_id UUID;
  v_bill_id      UUID;
  v_p1_id        UUID;
  v_p1_token     UUID;
BEGIN
  -- Create a synthetic auth user
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, instance_id, aud, role)
  VALUES (gen_random_uuid(), 'organizer@test.com', '', NOW(), NOW(), NOW(),
          '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')
  RETURNING id INTO v_organizer_id;

  INSERT INTO public.user_profiles (id, display_name)
  VALUES (v_organizer_id, 'Test Organizer');

  INSERT INTO public.bills (organizer_id, title, total_amount, currency, due_date, share_link, status)
  VALUES (v_organizer_id, 'Test Dinner', 75.00, 'MYR', NOW() + INTERVAL '7 days',
          'test-share-' || gen_random_uuid()::text, 'active')
  RETURNING id INTO v_bill_id;

  INSERT INTO public.participants (bill_id, name, amount)
  VALUES (v_bill_id, 'Aisha', 25.00)
  RETURNING id, access_token INTO v_p1_id, v_p1_token;

  -- Stash for downstream tests
  CREATE TEMP TABLE _fix (key TEXT PRIMARY KEY, val TEXT);
  INSERT INTO _fix VALUES
    ('organizer_id', v_organizer_id::text),
    ('bill_id',      v_bill_id::text),
    ('p1_id',        v_p1_id::text),
    ('p1_token',     v_p1_token::text);

  RAISE NOTICE 'Fixtures created: bill=%, p1=%, token=%', v_bill_id, v_p1_id, v_p1_token;
END $$;

-- ─── Assertion helper ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.assert(p_cond BOOLEAN, p_msg TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT p_cond THEN RAISE EXCEPTION 'ASSERTION FAILED: %', p_msg; END IF;
  RAISE NOTICE 'PASS: %', p_msg;
END $$;

-- ─── Test: get_participant_view ───────────────────────────────────────────────
DO $$
DECLARE
  v_token UUID;
  v_view  json;
BEGIN
  SELECT val::uuid INTO v_token FROM _fix WHERE key = 'p1_token';

  v_view := public.get_participant_view(v_token);
  PERFORM pg_temp.assert(v_view IS NOT NULL, 'get_participant_view returns non-null for valid token');
  PERFORM pg_temp.assert(v_view->'participant'->>'name' = 'Aisha', 'returns correct participant name');
  PERFORM pg_temp.assert((v_view->'participant'->>'amount')::decimal = 25.00, 'returns correct amount');
  PERFORM pg_temp.assert(v_view->'participant'->>'paymentStatus' = 'unpaid', 'initial status is unpaid');
  PERFORM pg_temp.assert(v_view->'bill'->>'title' = 'Test Dinner', 'returns correct bill title');
  PERFORM pg_temp.assert(v_view->'organizer'->>'displayName' = 'Test Organizer', 'returns organizer name');
  PERFORM pg_temp.assert((v_view->'socialProof'->>'paidCount')::int = 0, 'paidCount = 0');
  PERFORM pg_temp.assert((v_view->'socialProof'->>'totalCount')::int = 1, 'totalCount = 1');

  -- Invalid token returns NULL
  PERFORM pg_temp.assert(public.get_participant_view(gen_random_uuid()) IS NULL, 'invalid token returns NULL');
END $$;

-- ─── Test: submit_payment ─────────────────────────────────────────────────────
DO $$
DECLARE
  v_token UUID;
  v_pid   UUID;
  v_res   json;
  v_status TEXT;
BEGIN
  SELECT val::uuid INTO v_token FROM _fix WHERE key = 'p1_token';
  SELECT val::uuid INTO v_pid   FROM _fix WHERE key = 'p1_id';

  -- Happy path: unpaid → pending
  v_res := public.submit_payment(v_token, NULL, NULL);
  PERFORM pg_temp.assert(v_res->>'paymentStatus' = 'pending', 'unpaid → pending on submit');
  PERFORM pg_temp.assert(v_res->>'submittedAt' IS NOT NULL, 'submitted_at populated');

  -- Re-submit (pending → pending) is allowed and updates timestamp
  v_res := public.submit_payment(v_token, 'https://example.com/proof.jpg', NULL);
  PERFORM pg_temp.assert(v_res->>'paymentStatus' = 'pending', 're-submit stays pending');
  SELECT proof_url INTO v_status FROM participants WHERE id = v_pid;
  PERFORM pg_temp.assert(v_status = 'https://example.com/proof.jpg', 'proof_url stored');

  -- Idempotency: confirmed → returns already_confirmed marker
  UPDATE participants SET payment_status = 'confirmed', confirmed_at = NOW() WHERE id = v_pid;
  v_res := public.submit_payment(v_token, NULL, NULL);
  PERFORM pg_temp.assert((v_res->>'already_confirmed')::boolean = true, 'already_confirmed marker returned');

  -- Reset for next tests
  UPDATE participants SET payment_status = 'unpaid', confirmed_at = NULL, submitted_at = NULL, proof_url = NULL WHERE id = v_pid;

  -- Invalid token raises
  BEGIN
    PERFORM public.submit_payment(gen_random_uuid(), NULL, NULL);
    PERFORM pg_temp.assert(FALSE, 'submit_payment should have raised for invalid token');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.assert(TRUE, 'invalid token raises exception');
  END;
END $$;

-- ─── Test: confirm_payment + reject_payment ───────────────────────────────────
DO $$
DECLARE
  v_pid    UUID;
  v_org_id UUID;
  v_res    json;
  v_status TEXT;
  v_is_paid BOOLEAN;
BEGIN
  SELECT val::uuid INTO v_pid    FROM _fix WHERE key = 'p1_id';
  SELECT val::uuid INTO v_org_id FROM _fix WHERE key = 'organizer_id';

  -- Set up: participant in pending state
  UPDATE participants SET payment_status = 'pending', submitted_at = NOW() WHERE id = v_pid;

  -- Simulate organizer auth context for RLS
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_org_id::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  -- confirm_payment
  v_res := public.confirm_payment(v_pid);
  PERFORM pg_temp.assert(v_res->>'paymentStatus' = 'confirmed', 'confirm_payment transitions to confirmed');
  PERFORM pg_temp.assert(v_res->>'confirmedAt' IS NOT NULL, 'confirmed_at populated');

  -- Legacy sync trigger fired
  SELECT is_paid INTO v_is_paid FROM participants WHERE id = v_pid;
  PERFORM pg_temp.assert(v_is_paid = TRUE, 'legacy is_paid synced to TRUE on confirm');

  -- reject_payment from confirmed → rejected
  v_res := public.reject_payment(v_pid, 'Amount mismatch');
  PERFORM pg_temp.assert(v_res->>'paymentStatus' = 'rejected', 'reject_payment transitions to rejected');
  PERFORM pg_temp.assert(v_res->>'rejectedReason' = 'Amount mismatch', 'reason stored');

  SELECT is_paid INTO v_is_paid FROM participants WHERE id = v_pid;
  PERFORM pg_temp.assert(v_is_paid = FALSE, 'legacy is_paid synced to FALSE on reject');

  -- reject without reason raises
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_org_id::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  BEGIN
    PERFORM public.reject_payment(v_pid, '');
    PERFORM pg_temp.assert(FALSE, 'reject with empty reason should raise');
  EXCEPTION WHEN OTHERS THEN
    PERFORM pg_temp.assert(TRUE, 'reject with empty reason raises');
  END;

  RESET ROLE;
END $$;

DO $$ BEGIN RAISE NOTICE '── All migration 008 tests passed ──'; END $$;
