# Participant Payment Flow — Core Walking Skeleton — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the end-to-end participant payment flow walking skeleton — a unique per-participant URL (`{BASE}/p/{token}`) opens a public web page that shows only that participant's share, lets them swipe-to-confirm payment, transitions through a two-step `unpaid → pending → confirmed | rejected` state machine, and surfaces approve/reject controls in the organizer's invoice screen.

**Architecture:** Add `access_token` + `payment_status` columns to `participants`. A new public `app/p/[token].tsx` route loads via `SECURITY DEFINER` RPC `get_participant_view(token)`, which returns only that participant's data. Submissions flow through `submit_payment(token, ...)`. Organizer-side `confirm_payment` / `reject_payment` are RLS-gated. Status changes propagate live via Supabase Realtime so the participant page reacts the moment the organizer acts.

**Tech Stack:** React Native + Expo Router + Expo Web (already configured), Supabase (Postgres + Realtime + RLS), Zustand, jest-expo for unit tests, `psql` against local Supabase for SQL/RPC tests.

**Out of scope for this plan (separate plan later):** Proof image upload, Gemini proof intelligence, message thread + quick-reply chips, social-proof chip, early-payer badge, confetti, receipt card, DuitNow QR rendering, coin-drop animation, WhatsApp deep-link, rate limiting, deletion of legacy `share/[code]` page.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/008_participant_payment_flow.sql` | Create | `participants.access_token` + `payment_status` + supporting columns; legacy `is_paid` sync trigger; four new RPCs |
| `supabase/tests/008_participant_payment_flow.test.sql` | Create | SQL-level assertions for the four RPCs and the state machine |
| `src/lib/urls.ts` | Create | `participantUrl(token)` helper reading `EXPO_PUBLIC_WEB_BASE_URL` |
| `src/lib/urls.test.ts` | Create | Pure unit tests for `participantUrl` |
| `src/types/index.ts` | Modify | Add `PaymentFlowStatus`, extend `Participant`, add `ParticipantView` |
| `src/lib/supabase.ts` | Modify | Add `getParticipantView`, `submitPayment`, `confirmPayment`, `rejectPayment` client wrappers; map new participant fields in existing functions |
| `src/store/billStore.ts` | Modify | Map `access_token` + `payment_status` + other new fields when reading bills |
| `app/p/[token].tsx` | Create | Public participant page — loads view, renders status, swipe-to-confirm |
| `src/components/payment/StatusCard.tsx` | Create | Status-driven card (4 states) |
| `src/components/payment/SlideToConfirm.tsx` | Create | Pan-gesture swipe bar |
| `src/components/payment/PaymentReviewSheet.tsx` | Create | Organizer's approve/reject bottom sheet |
| `app/(modals)/bill/[id]/invoice.tsx` | Modify | Replace bill-level share with per-participant share; 4-state status pill; per-row action; mount review sheet |
| `app/_layout.tsx` | Modify (if needed) | Register `/p/[token]` route group as public (no auth gate) |
| `.env.local.example` | Create | Documents `EXPO_PUBLIC_WEB_BASE_URL` |

---

## Conventions

**Branching:** This plan lands as one feature branch `feature-participant-payment-core` against `main`. Each task commits independently on that branch.

**SQL test runner:** `supabase db reset` rebuilds schema from `supabase/migrations/`. Tests run as:
```
supabase db reset && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/008_participant_payment_flow.test.sql
```
Tests use raw SQL `DO $$ BEGIN ... IF ... THEN RAISE EXCEPTION ... END $$;` blocks for assertions.

**TS test runner:** `npm test -- --watchAll=false <file>` (jest-expo).

**Typecheck:** `npm run typecheck` after each TS change.

---

## Task 1: Migration 008 — Schema + Backfill

**Files:**
- Create: `supabase/migrations/008_participant_payment_flow.sql`

- [ ] **Step 1: Create migration file with schema changes**

Create `supabase/migrations/008_participant_payment_flow.sql`:

```sql
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
```

- [ ] **Step 2: Run migration locally**

Run:
```
supabase db reset
```
Expected: all migrations 001–008 apply cleanly, no errors.

- [ ] **Step 3: Verify new columns**

Run:
```
psql "$DATABASE_URL" -c "\d public.participants" | grep -E "access_token|payment_status|proof_url|submitted_at|confirmed_at|rejected_reason"
```
Expected: 6 lines, one per column.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/008_participant_payment_flow.sql
git commit -m "feat(db): add participant access_token + payment_status (migration 008)"
```

---

## Task 2: Append RPCs to Migration 008

**Files:**
- Modify: `supabase/migrations/008_participant_payment_flow.sql` (append)

- [ ] **Step 1: Append `get_participant_view` RPC**

Append to `supabase/migrations/008_participant_payment_flow.sql`:

```sql
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
```

- [ ] **Step 2: Append `submit_payment` RPC**

Append:

```sql
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
```

- [ ] **Step 3: Append `confirm_payment` RPC**

Append:

```sql
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
```

- [ ] **Step 4: Append `reject_payment` RPC**

Append:

```sql
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
```

- [ ] **Step 5: Re-run migration**

Run:
```
supabase db reset
```
Expected: clean, all four functions created.

- [ ] **Step 6: Smoke-test the functions exist**

Run:
```
psql "$DATABASE_URL" -c "\df public.get_participant_view public.submit_payment public.confirm_payment public.reject_payment"
```
Expected: four rows in the function list.

- [ ] **Step 7: Commit**

```
git add supabase/migrations/008_participant_payment_flow.sql
git commit -m "feat(db): add get_participant_view, submit_payment, confirm/reject RPCs"
```

---

## Task 3: SQL/RPC Tests

**Files:**
- Create: `supabase/tests/008_participant_payment_flow.test.sql`

- [ ] **Step 1: Create test file with fixture setup**

Create `supabase/tests/008_participant_payment_flow.test.sql`:

```sql
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
```

- [ ] **Step 2: Append `get_participant_view` tests**

Append to the test file:

```sql
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
```

- [ ] **Step 3: Append `submit_payment` tests**

Append:

```sql
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
```

- [ ] **Step 4: Append `confirm_payment` / `reject_payment` tests**

Append:

```sql
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
```

- [ ] **Step 5: Run the test suite**

Run:
```
supabase db reset && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/008_participant_payment_flow.test.sql
```
Expected: every `PASS:` line shown, ends with `── All migration 008 tests passed ──`. Any failure aborts with `ASSERTION FAILED`.

- [ ] **Step 6: Commit**

```
git add supabase/tests/008_participant_payment_flow.test.sql
git commit -m "test(db): SQL assertions for participant payment RPCs"
```

---

## Task 4: URL Helper

**Files:**
- Create: `src/lib/urls.ts`
- Create: `src/lib/urls.test.ts`
- Create: `.env.local.example`

- [ ] **Step 1: Write failing test**

Create `src/lib/urls.test.ts`:

```ts
describe('participantUrl', () => {
  const ORIGINAL_BASE = process.env.EXPO_PUBLIC_WEB_BASE_URL;

  afterEach(() => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = ORIGINAL_BASE;
    jest.resetModules();
  });

  it('uses localhost:8081 when env var is unset', () => {
    delete process.env.EXPO_PUBLIC_WEB_BASE_URL;
    const { participantUrl } = require('./urls');
    expect(participantUrl('abc-123')).toBe('http://localhost:8081/p/abc-123');
  });

  it('uses configured base URL when env var is set', () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://my-project.vercel.app';
    const { participantUrl } = require('./urls');
    expect(participantUrl('xyz-789')).toBe('https://my-project.vercel.app/p/xyz-789');
  });

  it('handles trailing slash in base URL', () => {
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://gocheck.app/';
    const { participantUrl } = require('./urls');
    expect(participantUrl('token-1')).toBe('https://gocheck.app/p/token-1');
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run:
```
npm test -- --watchAll=false src/lib/urls.test.ts
```
Expected: FAIL — Cannot find module './urls'.

- [ ] **Step 3: Implement `urls.ts`**

Create `src/lib/urls.ts`:

```ts
function getBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_WEB_BASE_URL ?? 'http://localhost:8081';
  return raw.replace(/\/+$/, '');
}

export function participantUrl(token: string): string {
  return `${getBaseUrl()}/p/${token}`;
}
```

- [ ] **Step 4: Run test to see it pass**

Run:
```
npm test -- --watchAll=false src/lib/urls.test.ts
```
Expected: all 3 tests PASS.

- [ ] **Step 5: Create `.env.local.example`**

Create `.env.local.example`:

```
# Base URL used by participantUrl() in src/lib/urls.ts.
# Local dev: leave unset (defaults to http://localhost:8081)
# Vercel:    set to https://<project>.vercel.app in Vercel project settings
# Future:    set to https://gocheck.app when custom domain is connected
EXPO_PUBLIC_WEB_BASE_URL=
```

- [ ] **Step 6: Commit**

```
git add src/lib/urls.ts src/lib/urls.test.ts .env.local.example
git commit -m "feat(web): participantUrl helper + EXPO_PUBLIC_WEB_BASE_URL env"
```

---

## Task 5: Extend TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `PaymentFlowStatus` and extend `Participant`**

Open `src/types/index.ts`. After the existing `PaymentStatus` type (around line 11), add:

```ts
export type PaymentFlowStatus = 'unpaid' | 'pending' | 'confirmed' | 'rejected';
```

Modify the `Participant` interface (around lines 13–24). Replace with:

```ts
export interface Participant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  amount: number;
  isPaid: boolean;
  paidAt?: string | null;
  avatarColor: string;
  shares?: number;
  percent?: number;
  // ── Per-participant payment flow (migration 008) ──
  accessToken?: string;
  paymentStatus: PaymentFlowStatus;
  proofUrl?: string;
  submittedAt?: string;
  confirmedAt?: string;
  rejectedReason?: string;
}
```

- [ ] **Step 2: Add `ParticipantView` type**

After the `Bill` interface (around line 73), add:

```ts
export interface ParticipantView {
  participant: {
    id: string;
    name: string;
    amount: number;
    paymentStatus: PaymentFlowStatus;
    proofUrl?: string;
    submittedAt?: string;
    confirmedAt?: string;
    rejectedReason?: string;
  };
  bill: {
    id: string;
    title: string;
    description?: string;
    currency: Currency;
    dueDate: string;
    status: BillStatus;
    invoiceNumber?: string;
    paymentMethod?: BillPaymentMethod;
    paymentDetails?: string;
  };
  organizer: {
    displayName: string;
    avatarUrl?: string;
  };
  socialProof: {
    paidCount: number;
    totalCount: number;
  };
}
```

- [ ] **Step 3: Run typecheck**

Run:
```
npm run typecheck
```
Expected: errors in any file that constructs a `Participant` without `paymentStatus`. Note them — they'll be fixed in Task 6.

- [ ] **Step 4: Commit**

```
git add src/types/index.ts
git commit -m "feat(types): add PaymentFlowStatus + ParticipantView; extend Participant"
```

---

## Task 6: Map New Participant Fields in Store and Client

**Files:**
- Modify: `src/store/billStore.ts` (around line 240)
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Update billStore participant mapper**

Open `src/store/billStore.ts`. Find the `.participants` block inside the bill mapper (around line 240–250) that looks like:

```ts
participants: (participantRows ?? []).map((p, i) => ({
  // ... existing fields
})),
```

Inside that mapper add the new fields. The mapper should now read:

```ts
participants: (participantRows ?? []).map((p, i) => ({
  id: p.id,
  name: p.name,
  email: p.email ?? undefined,
  phone: p.phone ?? undefined,
  amount: Number(p.amount),
  isPaid: Boolean(p.is_paid),
  paidAt: p.paid_at,
  avatarColor: p.avatar_color ?? AVATAR_COLORS[i % AVATAR_COLORS.length],
  shares: p.shares ?? undefined,
  percent: p.percent ?? undefined,
  accessToken:     p.access_token ?? undefined,
  paymentStatus:  (p.payment_status as 'unpaid'|'pending'|'confirmed'|'rejected') ?? 'unpaid',
  proofUrl:        p.proof_url ?? undefined,
  submittedAt:     p.submitted_at ?? undefined,
  confirmedAt:     p.confirmed_at ?? undefined,
  rejectedReason:  p.rejected_reason ?? undefined,
})),
```

If the existing mapper uses different field names or order, preserve them; only add the six new lines.

- [ ] **Step 2: Apply the same mapping in any other place that reads `participants` rows**

Run:
```
git grep -n "participants" src/store/billStore.ts src/lib/supabase.ts
```
For each location that constructs a `Participant` object from a `participants` row, add the same six new fields. Default `paymentStatus` to `'unpaid'` when null.

- [ ] **Step 3: Add client wrappers in `src/lib/supabase.ts`**

Open `src/lib/supabase.ts`. After the last existing exported function, append:

```ts
// ─── Participant Payment Flow (migration 008) ─────────────────────────────────

import type { ParticipantView, PaymentFlowStatus } from '../types';

export async function getParticipantView(token: string): Promise<ParticipantView | null> {
  const { data, error } = await supabase.rpc('get_participant_view', { p_token: token });
  if (error) throw error;
  return data as ParticipantView | null;
}

export async function submitPayment(
  token: string,
  proofUrl?: string,
  note?: string,
): Promise<{ paymentStatus: PaymentFlowStatus; submittedAt?: string; already_confirmed?: boolean }> {
  const { data, error } = await supabase.rpc('submit_payment', {
    p_token: token,
    p_proof_url: proofUrl ?? null,
    p_note: note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function confirmPayment(participantId: string): Promise<{ paymentStatus: PaymentFlowStatus; confirmedAt: string }> {
  const { data, error } = await supabase.rpc('confirm_payment', { p_participant_id: participantId });
  if (error) throw error;
  return data;
}

export async function rejectPayment(participantId: string, reason: string): Promise<{ paymentStatus: PaymentFlowStatus; rejectedReason: string }> {
  const { data, error } = await supabase.rpc('reject_payment', {
    p_participant_id: participantId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean — no `paymentStatus` errors remain.

- [ ] **Step 5: Commit**

```
git add src/store/billStore.ts src/lib/supabase.ts
git commit -m "feat(client): map participant payment fields + add RPC wrappers"
```

---

## Task 7: StatusCard Component

**Files:**
- Create: `src/components/payment/StatusCard.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/payment/StatusCard.tsx`:

```tsx
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import type { PaymentFlowStatus, Currency } from '../../types';
import { CURRENCY_SYMBOLS } from '../../types';

interface Props {
  status: PaymentFlowStatus;
  amount: number;
  currency: Currency;
  dueDate?: string;
  organizerName: string;
  confirmedAt?: string;
  rejectedReason?: string;
}

export function StatusCard({ status, amount, currency, dueDate, organizerName, confirmedAt, rejectedReason }: Props) {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  if (status === 'unpaid') {
    return (
      <View style={[styles.root, styles.unpaid]}>
        <Text style={styles.label}>Amount due</Text>
        <Text style={styles.amount}>{symbol}{amount.toFixed(2)}</Text>
        {dueDate && <Text style={styles.sub}>Due {format(new Date(dueDate), 'EEEE, d MMM yyyy')}</Text>}
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={[styles.root, styles.pending]}>
        <ActivityIndicator color="#B45309" />
        <Text style={[styles.label, { color: '#B45309' }]}>Waiting for {organizerName} to confirm</Text>
      </View>
    );
  }

  if (status === 'confirmed') {
    return (
      <View style={[styles.root, styles.confirmed]}>
        <Feather name="check-circle" size={32} color="#059669" />
        <Text style={[styles.amount, { color: '#059669' }]}>Paid ✓</Text>
        {confirmedAt && <Text style={[styles.sub, { color: '#059669' }]}>on {format(new Date(confirmedAt), 'd MMM yyyy, HH:mm')}</Text>}
      </View>
    );
  }

  // rejected
  return (
    <View style={[styles.root, styles.rejected]}>
      <Feather name="alert-circle" size={28} color="#DC2626" />
      <Text style={[styles.label, { color: '#DC2626' }]}>Payment couldn't be confirmed</Text>
      {rejectedReason && <Text style={styles.sub}>{rejectedReason}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius['2xl'], padding: spacing[5], alignItems: 'center', gap: spacing[2] },
  unpaid:    { backgroundColor: '#EFF6FF' },
  pending:   { backgroundColor: '#FEF3C7' },
  confirmed: { backgroundColor: '#D1FAE5' },
  rejected:  { backgroundColor: '#FEE2E2' },
  label:  { fontFamily: typography.sansMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  amount: { fontFamily: typography.sansBold, fontSize: fontSize['4xl'], color: colors.textPrimary },
  sub:    { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center' },
});
```

- [ ] **Step 2: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/components/payment/StatusCard.tsx
git commit -m "feat(payment): StatusCard component for 4 payment states"
```

---

## Task 8: SlideToConfirm Component

**Files:**
- Create: `src/components/payment/SlideToConfirm.tsx`

- [ ] **Step 1: Implement the swipe bar**

Create `src/components/payment/SlideToConfirm.tsx`:

```tsx
import { useCallback } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, radius, spacing } from '../../theme/tokens';
import { haptic, NotificationFeedbackType } from '../../lib/haptics';

interface Props {
  label?: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}

const THUMB = 56;
const HORIZONTAL_PADDING = spacing[4];

export function SlideToConfirm({ label = 'Slide to confirm I paid', onConfirm, disabled = false }: Props) {
  const { width } = useWindowDimensions();
  const trackWidth = Math.min(width - HORIZONTAL_PADDING * 2, 480);
  const maxTranslate = trackWidth - THUMB - 8;
  const offset = useSharedValue(0);

  const triggerConfirm = useCallback(() => {
    haptic.notification(NotificationFeedbackType.Success);
    onConfirm();
  }, [onConfirm]);

  const gesture = Gesture.Pan()
    .enabled(!disabled)
    .onUpdate((e) => {
      offset.value = Math.max(0, Math.min(e.translationX, maxTranslate));
    })
    .onEnd(() => {
      if (offset.value > maxTranslate * 0.85) {
        offset.value = withSpring(maxTranslate);
        runOnJS(triggerConfirm)();
      } else {
        offset.value = withSpring(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    width: offset.value + THUMB,
    opacity: interpolate(offset.value, [0, maxTranslate], [0.2, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.track, { width: trackWidth, opacity: disabled ? 0.5 : 1 }]}>
      <Animated.View style={[styles.fill, fillStyle]} />
      <Text style={styles.label}>{label}</Text>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          <Feather name="chevrons-right" size={22} color="#FFF" />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + 8,
    borderRadius: radius.full,
    backgroundColor: colors.gray100,
    justifyContent: 'center',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  label: {
    textAlign: 'center',
    fontFamily: typography.sansSemiBold,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  thumb: {
    position: 'absolute',
    left: 4, top: 4,
    width: THUMB, height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Verify haptics module shape**

Run:
```
git grep -n "export" src/lib/haptics.ts | head -10
```
Expected: exports include `haptic` and `NotificationFeedbackType`. If names differ, adjust the import in step 1 to match.

- [ ] **Step 3: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/components/payment/SlideToConfirm.tsx
git commit -m "feat(payment): SlideToConfirm pan-gesture swipe bar"
```

---

## Task 9: Participant Page (`app/p/[token].tsx`)

**Files:**
- Create: `app/p/[token].tsx`

- [ ] **Step 1: Implement the page**

Create `app/p/[token].tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { colors, typography, fontSize, spacing, radius } from '../../src/theme/tokens';
import { supabase, getParticipantView, submitPayment } from '../../src/lib/supabase';
import { StatusCard } from '../../src/components/payment/StatusCard';
import { SlideToConfirm } from '../../src/components/payment/SlideToConfirm';
import type { ParticipantView } from '../../src/types';

export default function ParticipantPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const [view, setView] = useState<ParticipantView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const v = await getParticipantView(token);
      if (!v) {
        setError('This link is no longer valid.');
      } else {
        setView(v);
      }
    } catch {
      setError('Unable to load. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Realtime: react to participant row updates
  useEffect(() => {
    if (!view?.participant.id) return;
    const channel = supabase
      .channel(`participant:${view.participant.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `id=eq.${view.participant.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [view?.participant.id, load]);

  const handleConfirm = useCallback(async () => {
    if (!token || submitting) return;
    setSubmitting(true);
    try {
      await submitPayment(token);
      await load();
    } catch {
      setError('Could not submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [token, submitting, load]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !view) {
    return (
      <View style={styles.centered}>
        <Feather name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorTitle}>Link unavailable</Text>
        <Text style={styles.errorText}>{error ?? 'This link is no longer valid.'}</Text>
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const { participant, bill, organizer } = view;
  const canSwipe = participant.paymentStatus === 'unpaid' || participant.paymentStatus === 'rejected';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing[6], paddingBottom: insets.bottom + spacing[8] }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
        <Text style={styles.brandName}>GoCheck</Text>
        {bill.invoiceNumber && <Text style={styles.brandMeta}>{bill.invoiceNumber}</Text>}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(80).duration(350)}>
        <StatusCard
          status={participant.paymentStatus}
          amount={participant.amount}
          currency={bill.currency}
          dueDate={bill.dueDate}
          organizerName={organizer.displayName}
          confirmedAt={participant.confirmedAt}
          rejectedReason={participant.rejectedReason}
        />
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(140).duration(350)} style={styles.greetBlock}>
        <Text style={styles.greet}>Hi {participant.name},</Text>
        <Text style={styles.greetSub}>
          {organizer.displayName} sent you "{bill.title}"
        </Text>
      </Animated.View>

      {bill.paymentMethod && bill.paymentDetails && (
        <Animated.View entering={FadeInUp.delay(200).duration(350)} style={styles.payCard}>
          <Text style={styles.payLabel}>HOW TO PAY</Text>
          <Text style={styles.payMethod}>
            {{
              duitnow: 'DuitNow',
              bank_transfer: 'Bank transfer',
              ewallet: 'eWallet / TNG',
              cash: 'Cash',
            }[bill.paymentMethod]}
          </Text>
          <Text style={styles.payDetails}>{bill.paymentDetails}</Text>
        </Animated.View>
      )}

      {canSwipe && (
        <Animated.View entering={FadeInUp.delay(260).duration(350)} style={styles.swipeBlock}>
          <SlideToConfirm onConfirm={handleConfirm} disabled={submitting} />
          <Text style={styles.swipeHint}>
            By confirming, you're telling {organizer.displayName} you've paid your share.
          </Text>
        </Animated.View>
      )}

      <Text style={styles.footer}>Secure record by GoCheck</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[4] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6] },
  errorTitle: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary, textAlign: 'center' },
  retry: { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  retryText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: '#FFF' },
  brand: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  brandName: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.primary },
  brandMeta: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textSecondary },
  greetBlock: { gap: spacing[1] },
  greet: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  greetSub: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.textSecondary },
  payCard: { backgroundColor: '#FFF', borderRadius: radius['2xl'], padding: spacing[5], gap: spacing[1] },
  payLabel: { fontFamily: typography.sansBold, fontSize: 10, letterSpacing: 1, color: colors.textSecondary },
  payMethod: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: colors.textPrimary },
  payDetails: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: fontSize.sm * 1.5 },
  swipeBlock: { gap: spacing[3], alignItems: 'center', marginTop: spacing[2] },
  swipeHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center' },
  footer: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing[4] },
});
```

- [ ] **Step 2: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Smoke-test on web**

Run:
```
npm run web
```

In a fresh browser tab, generate a valid token by running this SQL once in your local Supabase SQL editor and copy the output:

```sql
SELECT access_token FROM participants LIMIT 1;
```

Visit `http://localhost:8081/p/<paste-token-here>`.

Expected: page renders with the participant's name, amount, status card, and a swipe bar. Swiping commits and the status flips to `pending` after a moment.

- [ ] **Step 4: Verify error states**

Visit `http://localhost:8081/p/00000000-0000-0000-0000-000000000000`.
Expected: "Link unavailable" message.

- [ ] **Step 5: Commit**

```
git add app/p/[token].tsx
git commit -m "feat(web): participant payment page (/p/[token])"
```

---

## Task 10: Wire `_layout.tsx` So `/p/[token]` Is a Public Route

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Check the existing auth gate**

Run:
```
git grep -n "session\|signIn\|redirect\|router.replace" app/_layout.tsx
```
Read the auth-redirect logic. It likely redirects unauthenticated users to `/auth/sign-in`.

- [ ] **Step 2: Allow the `/p/` route prefix to bypass the gate**

In `app/_layout.tsx`, find the redirect block. It will look something like:

```tsx
useEffect(() => {
  if (!session && !inAuthGroup) router.replace('/auth/sign-in');
}, [session]);
```

Add a check for the `/p/` prefix using `usePathname` from expo-router:

```tsx
import { usePathname } from 'expo-router';
// ...inside the component:
const pathname = usePathname();
const isPublicRoute = pathname.startsWith('/p/') || pathname.startsWith('/share/');

useEffect(() => {
  if (!session && !inAuthGroup && !isPublicRoute) router.replace('/auth/sign-in');
}, [session, isPublicRoute]);
```

If the existing layout uses different variable names, adapt to match — the goal is: when `pathname` starts with `/p/`, **do not** redirect, regardless of auth state.

- [ ] **Step 3: Smoke-test in a private browser window**

Run:
```
npm run web
```
Open a private/incognito window (no signed-in session). Visit `http://localhost:8081/p/<valid-token>`.

Expected: page loads. No redirect to sign-in.

- [ ] **Step 4: Commit**

```
git add app/_layout.tsx
git commit -m "feat(routing): /p/[token] bypasses auth redirect"
```

---

## Task 11: Organizer-Side — Per-Participant Share

**Files:**
- Modify: `app/(modals)/bill/[id]/invoice.tsx`

- [ ] **Step 1: Import `participantUrl` and remove the bill-level `shareUrl`**

Open `app/(modals)/bill/[id]/invoice.tsx`. At the imports near the top, add:

```ts
import { participantUrl } from '../../../../src/lib/urls';
```

Find this block (around line 113):

```ts
const shareUrl = bill?.inviteToken ? `https://gocheck.app/invoice/${bill.inviteToken}` : undefined;
```

Delete that line. The bill-level URL is no longer surfaced.

- [ ] **Step 2: Replace `handleCopyLink` and `handleShare`**

Find `handleCopyLink` (around line 115) and `handleShare` (around line 123). Replace both with:

```ts
const handleShareParticipant = useCallback(async (p: Participant) => {
  if (!bill || !p.accessToken) return;
  const link = participantUrl(p.accessToken);
  const msg =
    `Hi ${p.name}, your share for "${bill.title}" is ${currencySymbol}${p.amount.toFixed(2)}.\n` +
    `Confirm here: ${link}`;
  await Share.share({ message: msg, url: link });
  haptic.notification(NotificationFeedbackType.Success);
}, [bill, currencySymbol]);
```

- [ ] **Step 3: Update the participant table to expose the per-row action**

Find the participant table row rendering (around line 230–245):

```tsx
{bill.participants.map((p) => (
  <View key={p.id} style={styles.tableRow}>
    {/* ... existing cells ... */}
    <View style={[styles.tableCell, styles.tableCellStatus]}>
      <PaymentStatusPill isPaid={p.isPaid} />
    </View>
  </View>
))}
```

Replace the `<View style={[styles.tableCell, styles.tableCellStatus]}>...</View>` block with a status-aware action cell:

```tsx
<View style={[styles.tableCell, styles.tableCellStatus]}>
  {p.paymentStatus === 'unpaid' && (
    <Pressable onPress={() => handleShareParticipant(p)} style={styles.rowAction}>
      <Feather name="send" size={14} color={colors.primary} />
      <Text style={styles.rowActionText}>Send link</Text>
    </Pressable>
  )}
  {p.paymentStatus === 'pending' && (
    <Pressable onPress={() => setReviewing(p)} style={[styles.rowAction, styles.rowActionPending]}>
      <Feather name="eye" size={14} color="#B45309" />
      <Text style={[styles.rowActionText, { color: '#B45309' }]}>Review</Text>
    </Pressable>
  )}
  {p.paymentStatus === 'confirmed' && (
    <View style={[styles.rowAction, styles.rowActionDone]}>
      <Feather name="check" size={14} color="#059669" />
      <Text style={[styles.rowActionText, { color: '#059669' }]}>Paid</Text>
    </View>
  )}
  {p.paymentStatus === 'rejected' && (
    <Pressable onPress={() => handleShareParticipant(p)} style={[styles.rowAction, styles.rowActionRejected]}>
      <Feather name="rotate-cw" size={14} color="#DC2626" />
      <Text style={[styles.rowActionText, { color: '#DC2626' }]}>Re-send</Text>
    </Pressable>
  )}
</View>
```

Add the `reviewing` state at the top of the component (next to other `useState` calls):

```ts
const [reviewing, setReviewing] = useState<Participant | null>(null);
```

Add the corresponding styles at the bottom of `StyleSheet.create({...})`:

```ts
rowAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: colors.primarySurface },
rowActionText: { fontFamily: typography.sansMedium, fontSize: 11, color: colors.primary },
rowActionPending: { backgroundColor: '#FEF3C7' },
rowActionDone: { backgroundColor: '#D1FAE5' },
rowActionRejected: { backgroundColor: '#FEE2E2' },
```

- [ ] **Step 4: Update the action buttons row**

Find the buttons row near the bottom of the JSX (around line 332–347 — the `actions` view with `Share Invoice` + `Copy Link`). Delete the entire `<Animated.View ... style={styles.actions}>` block — the per-row "Send link" replaces it.

- [ ] **Step 5: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean apart from the `reviewing`/`setReviewing` use-before-mount usage (will resolve once Task 12 mounts the sheet). If unresolved errors remain, fix them inline.

- [ ] **Step 6: Commit**

```
git add "app/(modals)/bill/[id]/invoice.tsx"
git commit -m "feat(invoice): per-participant share + 4-state status pills"
```

---

## Task 12: PaymentReviewSheet Component

**Files:**
- Create: `src/components/payment/PaymentReviewSheet.tsx`

- [ ] **Step 1: Implement the sheet**

Create `src/components/payment/PaymentReviewSheet.tsx`:

```tsx
import { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, Pressable, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { confirmPayment, rejectPayment } from '../../lib/supabase';
import { CURRENCY_SYMBOLS, type Participant, type Currency } from '../../types';

interface Props {
  participant: Participant | null;
  currency: Currency;
  onClose: () => void;
  onChanged: () => void;
}

export function PaymentReviewSheet({ participant, currency, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  if (!participant) return null;

  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;

  const handleApprove = async () => {
    setBusy('approve');
    try {
      await confirmPayment(participant.id);
      onChanged();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not approve.');
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    if (reason.trim().length === 0) {
      Alert.alert('Reason needed', 'Tell the participant why you're rejecting.');
      return;
    }
    setBusy('reject');
    try {
      await rejectPayment(participant.id, reason.trim());
      onChanged();
      onClose();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not reject.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>Review payment</Text>
          <Text style={styles.subtitle}>
            {participant.name} • {symbol}{participant.amount.toFixed(2)}
          </Text>

          {participant.submittedAt && (
            <Text style={styles.meta}>
              Submitted {new Date(participant.submittedAt).toLocaleString()}
            </Text>
          )}

          {!rejectMode ? (
            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.rejectBtn]}
                onPress={() => setRejectMode(true)}
                disabled={busy !== null}
              >
                <Feather name="x" size={18} color="#DC2626" />
                <Text style={[styles.btnText, { color: '#DC2626' }]}>Reject</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.approveBtn]}
                onPress={handleApprove}
                disabled={busy !== null}
              >
                {busy === 'approve'
                  ? <ActivityIndicator color="#FFF" />
                  : <>
                      <Feather name="check" size={18} color="#FFF" />
                      <Text style={[styles.btnText, { color: '#FFF' }]}>Approve</Text>
                    </>}
              </Pressable>
            </View>
          ) : (
            <View style={styles.rejectBlock}>
              <Text style={styles.rejectLabel}>Reason</Text>
              <TextInput
                style={styles.rejectInput}
                placeholder="e.g. Amount looks short, try again"
                value={reason}
                onChangeText={setReason}
                multiline
              />
              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.cancelBtn]} onPress={() => setRejectMode(false)}>
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.btn, styles.rejectConfirmBtn]}
                  onPress={handleReject}
                  disabled={busy !== null}
                >
                  {busy === 'reject'
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={[styles.btnText, { color: '#FFF' }]}>Send rejection</Text>}
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: radius['3xl'], borderTopRightRadius: radius['3xl'], padding: spacing[5], gap: spacing[3], ...shadow.lg },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.gray200 },
  title: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: colors.textPrimary },
  subtitle: { fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textSecondary },
  meta: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[3.5], borderRadius: radius.xl },
  approveBtn: { backgroundColor: '#059669' },
  rejectBtn:  { backgroundColor: '#FEE2E2' },
  cancelBtn:  { backgroundColor: colors.gray100 },
  rejectConfirmBtn: { backgroundColor: '#DC2626' },
  btnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base },
  rejectBlock: { gap: spacing[2] },
  rejectLabel: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  rejectInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing[3], minHeight: 80, fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textPrimary, textAlignVertical: 'top' },
});
```

- [ ] **Step 2: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/components/payment/PaymentReviewSheet.tsx
git commit -m "feat(payment): PaymentReviewSheet for organizer approve/reject"
```

---

## Task 13: Mount Review Sheet in Invoice Screen + Realtime Refresh

**Files:**
- Modify: `app/(modals)/bill/[id]/invoice.tsx`

- [ ] **Step 1: Mount the sheet**

Open `app/(modals)/bill/[id]/invoice.tsx`. At the top imports add:

```ts
import { PaymentReviewSheet } from '../../../../src/components/payment/PaymentReviewSheet';
```

In the return JSX, just before the closing `</View>` of the outer container (root style), add:

```tsx
<PaymentReviewSheet
  participant={reviewing}
  currency={bill.currency}
  onClose={() => setReviewing(null)}
  onChanged={() => fetchBills(sessionUserId)}
/>
```

- [ ] **Step 2: Subscribe to Realtime for all participants of this bill**

Inside the existing `useEffect` that loads the bill (around line 63), add a second `useEffect` below it:

```ts
useEffect(() => {
  if (!bill?.id) return;
  const channel = supabase
    .channel(`bill:${bill.id}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'participants',
      filter: `bill_id=eq.${bill.id}`,
    }, () => { fetchBills(sessionUserId); })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [bill?.id, sessionUserId, fetchBills]);
```

- [ ] **Step 3: Run typecheck**

Run:
```
npm run typecheck
```
Expected: clean.

- [ ] **Step 4: Smoke-test the full loop**

Run:
```
npm run web
```

In one browser window: sign in as organizer, open a bill's invoice screen.
In a private window: visit `http://localhost:8081/p/<token>` for one of the bill's participants.

1. In the private window, swipe to confirm → status flips to `pending`.
2. In the organizer window: the participant row should switch to a "Review" badge within ~1 second (Realtime).
3. Tap **Review** → sheet opens → tap **Approve**.
4. The private window's status card flips to `Paid ✓` within ~1 second.
5. In a third trial: tap **Reject** instead → enter a reason → confirm. Private window flips to `Payment couldn't be confirmed` with the reason.
6. From the rejected state, swipe again → goes back to `pending`.

If any step fails: dump the Postgres `participants` row and check `payment_status`, `submitted_at`, `confirmed_at`, `rejected_reason` match expectations.

- [ ] **Step 5: Commit**

```
git add "app/(modals)/bill/[id]/invoice.tsx"
git commit -m "feat(invoice): review sheet + Realtime refresh on participant updates"
```

---

## Task 14: Verify Deploy Configuration

**Files:**
- Modify: `app.json` (verify only)

- [ ] **Step 1: Confirm Expo Web is exporting static**

Open `app.json`. Verify the `web` block:

```json
"web": {
  "bundler": "metro",
  "output": "static",
  ...
}
```

If `output` is missing or set to `"single"`, change it to `"static"` so dynamic routes like `/p/[token]` are served correctly on Vercel.

- [ ] **Step 2: Verify build produces the route**

Run:
```
npx expo export --platform web
```
Expected: build completes. `dist/p/[token].html` (or equivalent dynamic route file) exists in the output.

```
ls dist/p/
```

- [ ] **Step 3: Document Vercel env var**

Append to `.env.local.example` (created in Task 4):

```

# When deploying to Vercel:
# - Build command: npx expo export --platform web
# - Output directory: dist
# - Add Environment Variable EXPO_PUBLIC_WEB_BASE_URL = https://<your-project>.vercel.app
```

- [ ] **Step 4: Commit**

```
git add app.json .env.local.example
git commit -m "chore(web): document Vercel deploy + EXPO_PUBLIC_WEB_BASE_URL"
```

---

## Task 15: Manual E2E Verification Checklist

**Files:** none (verification only)

- [ ] **Step 1: Reset DB to a known state**

Run:
```
supabase db reset
```

- [ ] **Step 2: Create a bill via the app with 3 participants**

In the app (web or mobile), sign in as an organizer, create a bill `"Plan walkthrough"` for RM 60 with three participants: `Aisha`, `Ben`, `Carol`.

- [ ] **Step 3: Open the invoice screen and grab each link**

Tap each participant's "Send link" action; copy the URL it would share (use the Share sheet preview, or tap the row's send icon and read `participantUrl(p.accessToken)` from a debug print).

Alternative: run
```
psql "$DATABASE_URL" -c "SELECT name, access_token FROM participants WHERE bill_id = '<bill-id>';"
```

- [ ] **Step 4: Open each link in a separate private/incognito tab**

For each: confirm only that participant's name and amount appear. Other participants should not be referenced.

- [ ] **Step 5: Submit in Aisha's tab**

Swipe to confirm. Status → `Waiting for {organizer} to confirm`.

- [ ] **Step 6: Approve in the organizer screen**

Aisha's row should switch to `Review` within ~1s. Tap, Approve. Aisha's tab shows `Paid ✓`.

- [ ] **Step 7: Submit + reject in Ben's tab**

Swipe in Ben's tab → Pending. In organizer screen, Review → Reject → reason `"Amount mismatch"`. Ben's tab shows reason and re-enabled swipe bar. Swipe again → back to Pending.

- [ ] **Step 8: Verify legacy `is_paid` is in sync**

Run:
```
psql "$DATABASE_URL" -c "SELECT name, payment_status, is_paid, paid_at, confirmed_at FROM participants WHERE bill_id = '<bill-id>';"
```
Expected: `is_paid = TRUE` for Aisha only; `is_paid = FALSE` for Ben (now Pending) and Carol (Unpaid).

- [ ] **Step 9: Verify error states**

Visit `http://localhost:8081/p/00000000-0000-0000-0000-000000000000`.
Expected: "Link unavailable".

Cancel the bill (set `bills.status = 'cancelled'` directly in SQL):
```
psql "$DATABASE_URL" -c "UPDATE bills SET status='cancelled' WHERE id='<bill-id>';"
```
Refresh Aisha's tab. `bill.status` should now be `cancelled` in the view — note: the page in this walking-skeleton plan does not yet special-case cancelled bills; that will be handled in a follow-up plan. For now, the page still renders the paid receipt for Aisha, which is acceptable.

- [ ] **Step 10: Tag the milestone**

```
git tag participant-payment-core-v1
git log --oneline -20 | head
```

---

## Open Items (Deferred to Layer-2 Plan)

These spec items are explicitly **not** in this plan and will be addressed in `2026-06-XX-participant-payment-flow-layer-2.md`:

- Proof image upload (`payment-proofs` storage bucket, `create-proof-upload-url` edge function)
- Gemini proof intelligence (`scan-payment-proof` edge function, `proof_extracted` JSONB column, AI summary banner)
- Message thread (`participant_messages` table, `post_*_message` RPCs, `mark_*_read` RPC, thread UI, quick-reply chips)
- Confetti + savable receipt card
- Anonymized social-proof chip + early-payer badge on the page (RPC already returns the counts)
- Local DuitNow QR generation
- Coin-drop animation on organizer side
- WhatsApp deep-link share option
- Rate limiting via `rate_limit_log` table
- Bill-cancelled special state on participant page
- Removal of legacy `share/[code]` route + `share_links` table cleanup

---

**End of plan.**
