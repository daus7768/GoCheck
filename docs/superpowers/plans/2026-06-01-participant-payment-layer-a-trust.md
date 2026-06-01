# Participant Payment Flow — Layer A: Trust & Verification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let participants optionally attach a payment receipt screenshot to their `/p/{token}` page. A new `scan-payment-proof` edge function uploads the image to a private Storage bucket, calls Gemini to extract amount + reference + bank, compares against expected, and writes back to the participant row. The participant sees inline "Looks right ✓" or "We read RM 22 — double-check?" feedback. The organizer's review sheet shows an AI summary banner with a tap-to-view image; the Approve button pulses on high-confidence matches.

**Architecture:** Single-roundtrip edge function (Approach A from the spec) — client base64-encodes the image and posts to `scan-payment-proof`, which validates, scans, uploads, and updates the DB row atomically. Realtime broadcasts the new `proof_summary` field to both participant page and any open organizer sheet via the existing publication + REPLICA IDENTITY FULL configured in migration 009.

**Tech Stack:** React Native + Expo Web (SDK 51), Supabase Postgres + Storage + Edge Functions (Deno), Gemini 2.5 Flash via existing `_shared/gemini.ts` helpers, expo-image-picker on mobile / native `<input type="file">` on web.

**Builds on:** branch `feature/participant-payment-core` (migrations 008+009, RPCs, components, /p/[token] page, PaymentReviewSheet, dashboard wiring).

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/010_proof_intelligence.sql` | Create | Adds `proof_extracted JSONB` + `proof_summary TEXT` on participants; redefines `get_participant_view` to include the new fields; creates private `payment-proofs` storage bucket; adds `clear_payment_proof` RPC. |
| `supabase/tests/010_proof_intelligence.test.sql` | Create | SQL assertions: clear RPC happy path, invalid token, get_participant_view returns new fields. |
| `supabase/functions/scan-payment-proof/index.ts` | Create | Edge function: validate token + image → call Gemini → compute match → upload to Storage → write DB row. |
| `src/types/index.ts` | Modify | Add `ProofExtraction` type; extend `Participant` and `ParticipantView` with `proofExtracted` + `proofSummary`. |
| `src/lib/supabase.ts` | Modify | (a) extend `getOrganizerBills` SELECT to include `proof_extracted`, `proof_summary`; (b) add `scanPaymentProof` and `clearPaymentProof` wrappers. |
| `src/store/billStore.ts` | Modify | `mapParticipantRow` reads two new fields. |
| `src/components/payment/ProofUpload.tsx` | Create | 6-state proof upload + scan + display block; platform-branched image picker. |
| `src/components/payment/AISummaryBanner.tsx` | Create | 4-variant banner with thumbnail; exports `getMatchLevel` helper. |
| `app/p/[token].tsx` | Modify | Replace existing simple proof placeholder with `<ProofUpload />`; pass `proofExtracted` etc. |
| `src/components/payment/PaymentReviewSheet.tsx` | Modify | Mount `<AISummaryBanner />`; manage image viewer modal; pulse Approve on `matchLevel === 'high'`. |

---

## Conventions

**Worktree:** Create a worktree off `feature/participant-payment-core` (not main):
```bash
git fetch
git worktree add ~/.config/superpowers/worktrees/GoCheck_v2/feature-participant-payment-layer-a feature/participant-payment-core -b feature/participant-payment-layer-a
cd ~/.config/superpowers/worktrees/GoCheck_v2/feature-participant-payment-layer-a
NODE_ENV=development npm install --legacy-peer-deps
```

**Typecheck:** `NODE_ENV=development npx tsc --noEmit`

**Tests:** `NODE_ENV=development npx jest --watchAll=false`

**SQL apply:** Either via Supabase MCP `apply_migration` or the dashboard SQL editor. There is no local Supabase CLI in this project.

**Edge fn deploy:** Via Supabase MCP `deploy_edge_function` (the user has authenticated MCP access).

---

## Task 1: Migration 010 — Schema + Bucket + clear_payment_proof RPC

**Files:**
- Create: `supabase/migrations/010_proof_intelligence.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/010_proof_intelligence.sql`:

```sql
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
```

- [ ] **Step 2: Apply via Supabase MCP**

The implementer running this plan should call `mcp__supabase__apply_migration` with `name: "proof_intelligence"` and the SQL above. If running this plan manually, paste the SQL into the dashboard SQL editor.

- [ ] **Step 3: Verify columns and bucket exist**

Run via `mcp__supabase__execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='participants'
  AND column_name IN ('proof_extracted','proof_summary');
SELECT id FROM storage.buckets WHERE id='payment-proofs';
SELECT proname FROM pg_proc WHERE proname='clear_payment_proof';
```

Expected: 2 rows, 1 row, 1 row.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/010_proof_intelligence.sql
git commit -m "feat(db): migration 010 — proof columns + bucket + clear RPC"
```

---

## Task 2: Redefine get_participant_view to include proof fields

**Files:**
- Modify: `supabase/migrations/010_proof_intelligence.sql` (append)

- [ ] **Step 1: Append the redefinition to migration 010**

Append this block to `supabase/migrations/010_proof_intelligence.sql`:

```sql

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
```

- [ ] **Step 2: Re-apply the migration**

Same as Task 1 Step 2 — call `mcp__supabase__apply_migration` again with the FULL updated file content. Idempotent ops (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, `ON CONFLICT DO NOTHING`) make this safe to re-run.

Alternative: run only the new `CREATE OR REPLACE FUNCTION` block via `mcp__supabase__execute_sql` to avoid re-running the entire file.

- [ ] **Step 3: Smoke-test the redefined function**

```sql
SELECT public.get_participant_view(access_token) -> 'participant' -> 'proofSummary' AS proof_summary
FROM participants LIMIT 1;
```

Expected: returns `null` (no proof yet) for any existing participant. The KEY `proofSummary` is present in the JSON shape — that's what matters.

- [ ] **Step 4: Commit**

```
git add supabase/migrations/010_proof_intelligence.sql
git commit -m "feat(db): get_participant_view exposes proofExtracted + proofSummary"
```

---

## Task 3: SQL tests for migration 010

**Files:**
- Create: `supabase/tests/010_proof_intelligence.test.sql`

- [ ] **Step 1: Create the test file**

Create `supabase/tests/010_proof_intelligence.test.sql`:

```sql
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
```

- [ ] **Step 2: Run the test file against the remote DB**

Either via `mcp__supabase__execute_sql` pasting chunks (the dashboard runs the whole file but MCP needs single statements — break by `DO $$` block) or via the Supabase dashboard SQL editor (paste the whole file, run).

Expected output: a stream of `NOTICE: PASS:` lines ending with `── All migration 010 tests passed ──`.

- [ ] **Step 3: Commit**

```
git add supabase/tests/010_proof_intelligence.test.sql
git commit -m "test(db): assertions for migration 010 — clear RPC + view shape"
```

---

## Task 4: Edge function `scan-payment-proof`

**Files:**
- Create: `supabase/functions/scan-payment-proof/index.ts`

- [ ] **Step 1: Create the edge function file**

Create `supabase/functions/scan-payment-proof/index.ts`:

```ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { callGemini, checkRateLimit, corsHeaders, extractJson, rateLimitResponse } from '../_shared/gemini.ts';

interface ScanRequest {
  token: string;
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

interface GeminiExtraction {
  amount: number | null;
  currency: string | null;
  reference: string | null;
  bank: string | null;
  date: string | null;
  confidence: number;
}

interface PersistedExtraction extends GeminiExtraction {
  matchesExpected: boolean;
}

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 4_000_000;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function extToMime(mime: string): 'jpg' | 'png' | 'webp' {
  return mime === 'image/jpeg' ? 'jpg' : mime === 'image/png' ? 'png' : 'webp';
}

function buildSummary(e: PersistedExtraction, expected: number): string {
  if (e.confidence < 0.7 || e.amount == null) {
    return 'Could not read amount confidently — please review manually';
  }
  const amountStr = `RM ${e.amount.toFixed(2)}`;
  const fromBank = e.bank ? ` from ${e.bank}` : '';
  const refStr = e.reference ? `, ref ${e.reference}` : '';
  if (e.matchesExpected) {
    return `Receipt${fromBank}, ${amountStr}${refStr} — matches expected ✓`;
  }
  return `Receipt${fromBank} shows ${amountStr} — expected RM ${expected.toFixed(2)}`;
}

const PROMPT = `You are analysing a Malaysian bank transfer or e-wallet payment receipt
screenshot. Extract the payment details and return ONLY a JSON object.
No markdown fences, no explanation, no text outside the JSON.

Return exactly this shape:
{
  "amount": 0.00,
  "currency": "MYR",
  "reference": "transaction reference / receipt number, or null",
  "bank": "bank or e-wallet name (e.g. Maybank, Touch 'n Go, GrabPay, Boost, DuitNow), or null",
  "date": "YYYY-MM-DD",
  "confidence": 0.0
}

Rules:
- amount is the AMOUNT TRANSFERRED to the recipient, not the sender's
  balance. Look for "Amount", "Jumlah", "Transfer Amount".
- currency defaults to MYR unless the receipt clearly shows otherwise.
- reference is the transaction ID, receipt number, or DuitNow reference.
  If multiple candidates, prefer the one labelled "Reference" or "Ref".
- bank is the sending bank or e-wallet provider name as shown.
- date is the transfer date in YYYY-MM-DD; use today if not visible.
- confidence is your overall read accuracy (0.0 to 1.0).
  Lower it if the image is blurry, partial, or doesn't look like a
  payment receipt at all.
- For unreadable strings use null. For unreadable amount use 0.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // Gemini key check
  if (!Deno.env.get('GEMINI_API_KEY')) {
    return jsonResponse({ success: false, error: 'Scan service not configured' }, 500);
  }

  // Rate limit (per IP, 30/min via shared helper)
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) return rateLimitResponse();

  // Parse + validate
  let body: ScanRequest;
  try {
    body = await req.json() as ScanRequest;
  } catch {
    return jsonResponse({ success: false, error: 'Invalid request body' }, 400);
  }
  if (!body?.token || !isUuid(body.token)) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 400);
  }
  if (!body.imageBase64 || !body.mimeType) {
    return jsonResponse({ success: false, error: 'Missing imageBase64 or mimeType' }, 400);
  }
  if (!ALLOWED_MIMES.includes(body.mimeType)) {
    return jsonResponse({ success: false, error: 'Use JPG, PNG, or WebP' }, 400);
  }

  // Strip data-URI prefix if present
  const rawBase64 = body.imageBase64.includes(',')
    ? (body.imageBase64.split(',')[1] ?? '')
    : body.imageBase64;
  if (!rawBase64) {
    return jsonResponse({ success: false, error: 'Empty image payload' }, 400);
  }
  const byteLength = Math.ceil((rawBase64.length * 3) / 4);
  if (byteLength > MAX_BYTES) {
    return jsonResponse({ success: false, error: 'Image too large (max 4 MB)' }, 400);
  }

  // Service-role client for DB + Storage
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Look up participant
  const { data: participant, error: pErr } = await supabase
    .from('participants')
    .select('id, bill_id, amount')
    .eq('access_token', body.token)
    .single();
  if (pErr || !participant) {
    return jsonResponse({ success: false, error: 'Invalid token' }, 404);
  }
  const participantId: string = participant.id;
  const expectedAmount: number = Number(participant.amount);

  // Call Gemini
  let rawText: string;
  try {
    rawText = await callGemini(
      [{ inline_data: { mime_type: body.mimeType, data: rawBase64 } }, { text: PROMPT }],
      { temperature: 0.1, maxOutputTokens: 800, responseMimeType: 'application/json' },
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error('[scan-payment-proof] gemini call failed:', detail);
    const isQuota = /\b429\b|quota|RESOURCE_EXHAUSTED/i.test(detail);
    return jsonResponse({
      success: false,
      error: isQuota
        ? 'AI scan unavailable, you can still confirm without proof'
        : 'Could not read receipt, you can still confirm without proof',
    });
  }

  let extracted: GeminiExtraction;
  try {
    extracted = extractJson<GeminiExtraction>(rawText);
  } catch (err) {
    console.error('[scan-payment-proof] JSON parse failed. Raw:', rawText);
    return jsonResponse({
      success: false,
      error: 'Could not read receipt, you can still confirm without proof',
    });
  }

  const matchesExpected =
    typeof extracted.amount === 'number' &&
    extracted.confidence >= 0.7 &&
    Math.abs(extracted.amount - expectedAmount) <= 0.1;
  const persisted: PersistedExtraction = { ...extracted, matchesExpected };
  const summary = buildSummary(persisted, expectedAmount);

  // Upload to Storage (overwrite via upsert)
  const ext = extToMime(body.mimeType);
  const proofPath = `${participantId}/proof.${ext}`;
  const bytes = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));

  const { error: upErr } = await supabase.storage
    .from('payment-proofs')
    .upload(proofPath, bytes, { contentType: body.mimeType, upsert: true });
  if (upErr) {
    console.error('[scan-payment-proof] storage upload failed:', upErr.message);
    return jsonResponse({ success: false, error: 'Upload failed, try again' });
  }

  // Persist to participant row
  const { error: dbErr } = await supabase
    .from('participants')
    .update({
      proof_url: proofPath,
      proof_extracted: persisted,
      proof_summary: summary,
    })
    .eq('id', participantId);
  if (dbErr) {
    console.error('[scan-payment-proof] DB update failed:', dbErr.message);
    return jsonResponse({ success: false, error: 'Could not save proof' });
  }

  return jsonResponse({
    success: true,
    summary,
    extracted: persisted,
    proofUrl: proofPath,
  });
});
```

- [ ] **Step 2: Verify the file is syntactically valid Deno TypeScript**

There's no local Deno runtime in the project. Visual check the import paths match `_shared/gemini.ts` exports (`callGemini`, `extractJson`, `checkRateLimit`, `corsHeaders`, `rateLimitResponse`) and the `createClient` esm.sh URL matches what `notify-organizer` already uses.

- [ ] **Step 3: Commit**

```
git add supabase/functions/scan-payment-proof/index.ts
git commit -m "feat(fn): scan-payment-proof edge function (Gemini + Storage + DB)"
```

---

## Task 5: Deploy edge function + smoke test

**Files:** none (deployment + verification)

- [ ] **Step 1: Deploy via Supabase MCP**

The implementer should call `mcp__supabase__deploy_edge_function` with:
- `name: "scan-payment-proof"`
- `entrypoint_path: "index.ts"`
- File contents from Task 4 Step 1

If running this plan manually outside MCP, push to Supabase via the dashboard's "Edge Functions" panel.

- [ ] **Step 2: Verify deployment**

```
mcp__supabase__list_edge_functions
```
Expected: `scan-payment-proof` appears in the list with `status: ACTIVE`.

- [ ] **Step 3: Smoke-test via curl with a tiny PNG**

Make a 1x1 transparent PNG base64 (any will do — it'll fail the scan with low confidence, but proves the function plumbing works):

```bash
TOKEN=$(echo "SELECT access_token FROM participants LIMIT 1" | psql_via_mcp)
# Or call mcp__supabase__execute_sql with that SELECT and copy the value.

ANON_KEY="<from app.json extra.supabaseAnonKey>"
PROJECT_URL="https://bccarnwtdqamedtlzdht.supabase.co"

curl -X POST "$PROJECT_URL/functions/v1/scan-payment-proof" \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"imageBase64\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=\",\"mimeType\":\"image/png\"}"
```

Expected: a JSON response with `success: false, error: ...` — likely "Could not read receipt" (Gemini can't make sense of a 1x1 transparent pixel). Even though the scan failed gracefully, this proves: token validation works, image validation works, Gemini was called, and no DB row was corrupted.

Verify the participant row is unchanged:
```sql
SELECT proof_url, proof_summary FROM participants WHERE access_token='<token>';
```
Both should still be NULL.

- [ ] **Step 4: Commit (none required for deploy)**

No file changes from deployment — Task 4's commit already includes the code.

---

## Task 6: TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add `ProofExtraction` interface**

Open `src/types/index.ts`. Locate the existing `PaymentFlowStatus` type. Below it, add:

```ts
export interface ProofExtraction {
  amount: number | null;
  currency: string | null;
  reference: string | null;
  bank: string | null;
  date: string | null;
  confidence: number;
  matchesExpected: boolean;
}
```

- [ ] **Step 2: Extend `Participant` interface**

Find the `Participant` interface (extended in migration 008). Add two new optional fields after `rejectedReason`:

```ts
  proofExtracted?: ProofExtraction;
  proofSummary?: string;
```

- [ ] **Step 3: Extend `ParticipantView.participant` sub-object**

Find the `ParticipantView` interface. In the `participant` sub-object literal, add the same two fields after `rejectedReason`:

```ts
    proofExtracted?: ProofExtraction;
    proofSummary?: string;
```

- [ ] **Step 4: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```

Expected: clean (no new errors). If typecheck flags an existing import that now needs `ProofExtraction`, add it where the error points.

- [ ] **Step 5: Commit**

```
git add src/types/index.ts
git commit -m "feat(types): add ProofExtraction; extend Participant + ParticipantView"
```

---

## Task 7: Extend `getOrganizerBills` SELECT

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add the two new columns to the participants sub-select**

Find `getOrganizerBills` (around line 143). In the SELECT string, locate the `participants ( ... )` sub-select. Replace its body with:

```ts
      participants (
        id, name, email, phone, amount, is_paid, paid_at, avatar_color, shares, percent,
        access_token, payment_status, proof_url, submitted_at, confirmed_at, rejected_reason,
        proof_extracted, proof_summary
      ),
```

- [ ] **Step 2: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/lib/supabase.ts
git commit -m "feat(client): pull proof_extracted + proof_summary in getOrganizerBills"
```

---

## Task 8: Extend `mapParticipantRow`

**Files:**
- Modify: `src/store/billStore.ts`

- [ ] **Step 1: Read the two new fields**

Find `mapParticipantRow` (around line 67). After the existing `rejectedReason: ...` line, add:

```ts
    proofExtracted: (p['proof_extracted'] as ProofExtraction | undefined) ?? undefined,
    proofSummary:   (p['proof_summary']   as string         | undefined) ?? undefined,
```

- [ ] **Step 2: Add `ProofExtraction` to the imports**

At the top of `src/store/billStore.ts`, the existing imports from `../types` should include `Participant`, `Bill`, `SplitType`, etc. Add `ProofExtraction`:

```ts
import type { Bill, Currency, Participant, SplitType, LineItemComputed, ProofExtraction } from '../types';
```

Match the existing import shape — only ADD `ProofExtraction`, don't remove anything.

- [ ] **Step 3: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/store/billStore.ts
git commit -m "feat(client): map proof_extracted + proof_summary in billStore"
```

---

## Task 9: Client wrappers for scan + clear

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add `scanPaymentProof` and `clearPaymentProof`**

At the BOTTOM of `src/lib/supabase.ts` (after the existing `rejectPayment` wrapper added in migration 008's task), append:

```ts
// ─── Layer A: scan + clear proof ──────────────────────────────────────────────

import type { ProofExtraction } from '../types';

export type ScanProofResult =
  | { success: true; summary: string; extracted: ProofExtraction; proofUrl: string }
  | { success: false; error: string };

export async function scanPaymentProof(
  token: string,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<ScanProofResult> {
  const { data, error } = await supabase.functions.invoke('scan-payment-proof', {
    body: { token, imageBase64, mimeType },
  });
  if (error) return { success: false, error: error.message };
  return data as ScanProofResult;
}

export async function clearPaymentProof(token: string): Promise<{ id: string; cleared: boolean }> {
  const { data, error } = await supabase.rpc('clear_payment_proof', { p_token: token });
  if (error) throw error;
  return data as { id: string; cleared: boolean };
}
```

**Important:** the top of `src/lib/supabase.ts` already has `import type { UserProfile, ParticipantView, PaymentFlowStatus } from '../types';`. Either move the new `ProofExtraction` import to that line OR keep it inline at the bottom. Both are TypeScript-legal; the inline version (as written above) keeps the layer cohesive.

- [ ] **Step 2: Verify typecheck + tests**

```
NODE_ENV=development npx tsc --noEmit
NODE_ENV=development npx jest --watchAll=false
```
Expected: clean + 33/33.

- [ ] **Step 3: Commit**

```
git add src/lib/supabase.ts
git commit -m "feat(client): scanPaymentProof + clearPaymentProof wrappers"
```

---

## Task 10: `ProofUpload` component

**Files:**
- Create: `src/components/payment/ProofUpload.tsx`

- [ ] **Step 1: Install `expo-image-picker`**

Already in the codebase? Check:
```
grep '"expo-image-picker"' package.json
```
If missing:
```
NODE_ENV=development npx expo install expo-image-picker
```
Commit the package.json/lockfile change separately if it changes:
```
git add package.json package-lock.json
git commit -m "chore(deps): expo-image-picker for proof upload"
```
(Skip this commit if the dep is already in package.json.)

- [ ] **Step 2: Create the component**

Create `src/components/payment/ProofUpload.tsx`:

```tsx
import { useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Image, Alert, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import { scanPaymentProof, clearPaymentProof, supabase } from '../../lib/supabase';
import type { ProofExtraction } from '../../types';

interface Props {
  token: string;
  organizerName: string;
  proofUrl?: string;
  proofSummary?: string;
  proofExtracted?: ProofExtraction;
  onChanged: () => void;
}

type UiState = 'idle' | 'uploading' | 'attached';

export function ProofUpload({ token, organizerName, proofUrl, proofSummary, proofExtracted, onChanged }: Props) {
  const [busy, setBusy] = useState<'upload' | 'clear' | null>(null);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbExpiresAt, setThumbExpiresAt] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uiState: UiState = busy === 'upload' ? 'uploading' : proofUrl ? 'attached' : 'idle';

  // Generate a fresh signed URL for the proof thumbnail (60s TTL)
  const getThumb = useCallback(async () => {
    if (!proofUrl) return null;
    if (thumbUrl && Date.now() < thumbExpiresAt) return thumbUrl;
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60);
    if (error || !data) return null;
    setThumbUrl(data.signedUrl);
    setThumbExpiresAt(Date.now() + 55_000);
    return data.signedUrl;
  }, [proofUrl, thumbUrl, thumbExpiresAt]);

  // Whenever proofUrl changes (parent reloaded), refresh the thumb
  if (proofUrl && !thumbUrl) { void getThumb(); }

  // ── Image picking ─────────────────────────────────────────────────────────
  const handleScan = useCallback(async (base64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp') => {
    setBusy('upload');
    try {
      const res = await scanPaymentProof(token, base64, mimeType);
      if (!res.success) {
        Alert.alert('Scan failed', res.error);
      }
      // Always reload — even on failure, the parent may want to clear stale state.
      onChanged();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not upload');
    } finally {
      setBusy(null);
    }
  }, [token, onChanged]);

  const handlePickWeb = () => fileInputRef.current?.click();

  const handleWebFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      Alert.alert('Wrong format', 'JPG, PNG, or WebP only');
      return;
    }
    if (file.size > 4_000_000) {
      Alert.alert('Image too large', 'Max 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] ?? '';
      void handleScan(base64, file.type as 'image/jpeg' | 'image/png' | 'image/webp');
    };
    reader.readAsDataURL(file);
  };

  const handlePickMobile = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'GoCheck needs photo access to attach proof.');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (r.canceled || !r.assets?.[0]) return;
    const a = r.assets[0];
    if (!a.base64) {
      Alert.alert('Error', 'Could not read image');
      return;
    }
    // Determine MIME from URI extension
    const ext = a.uri.toLowerCase().match(/\.(jpe?g|png|webp)(\?|$)/)?.[1];
    const mime: 'image/jpeg' | 'image/png' | 'image/webp' =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    void handleScan(a.base64, mime);
  };

  const handleClear = async () => {
    setBusy('clear');
    try {
      await clearPaymentProof(token);
      setThumbUrl(null);
      onChanged();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not clear');
    } finally {
      setBusy(null);
    }
  };

  // ── Variant helpers ──────────────────────────────────────────────────────
  const variant = (() => {
    if (!proofUrl) return 'idle' as const;
    if (busy === 'upload') return 'uploading' as const;
    if (!proofExtracted) return 'unread' as const;
    if (proofExtracted.confidence < 0.7) return 'unread' as const;
    return proofExtracted.matchesExpected ? 'match' : 'mismatch';
  })();

  const variantTint =
    variant === 'match'    ? { bg: '#D1FAE5', icon: '#059669', label: '#065F46' } :
    variant === 'mismatch' ? { bg: '#FEF3C7', icon: '#B45309', label: '#92400E' } :
    variant === 'unread'   ? { bg: colors.gray100, icon: colors.textSecondary, label: colors.textPrimary } :
                             { bg: colors.gray50, icon: colors.textSecondary, label: colors.textPrimary };

  const variantIcon: keyof typeof Feather.glyphMap =
    variant === 'match'    ? 'check-circle' :
    variant === 'mismatch' ? 'alert-triangle' :
                             'info';

  // ── Render ───────────────────────────────────────────────────────────────
  if (uiState === 'idle') {
    return (
      <View style={[styles.root, { backgroundColor: '#FFF' }]}>
        <Text style={styles.label}>ATTACH PROOF OF PAYMENT</Text>
        <Text style={styles.hint}>Optional, but helps {organizerName} confirm faster</Text>
        {Platform.OS === 'web' && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleWebFile}
            style={{ display: 'none' }}
          />
        )}
        <Pressable onPress={Platform.OS === 'web' ? handlePickWeb : handlePickMobile} style={styles.pickBtn}>
          <Feather name="camera" size={16} color={colors.primary} />
          <Text style={styles.pickBtnText}>Choose receipt screenshot</Text>
        </Pressable>
      </View>
    );
  }

  if (uiState === 'uploading') {
    return (
      <View style={[styles.root, { backgroundColor: colors.gray50 }]}>
        <View style={styles.attachedRow}>
          <View style={styles.thumbWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
          <View style={styles.attachedInfo}>
            <Text style={styles.attachedTitle}>Reading receipt…</Text>
            <Text style={styles.hint}>This takes a couple of seconds</Text>
          </View>
        </View>
      </View>
    );
  }

  // attached
  return (
    <View style={[styles.root, { backgroundColor: variantTint.bg }]}>
      <View style={styles.attachedRow}>
        <View style={styles.thumbWrap}>
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
        <View style={styles.attachedInfo}>
          <View style={styles.attachedTitleRow}>
            <Feather name={variantIcon} size={14} color={variantTint.icon} />
            <Text style={[styles.attachedTitle, { color: variantTint.label }]} numberOfLines={2}>
              {proofSummary ?? 'Proof attached'}
            </Text>
          </View>
          {variant === 'mismatch' && (
            <Pressable onPress={Platform.OS === 'web' ? handlePickWeb : handlePickMobile} style={styles.reUploadHint}>
              <Text style={styles.reUploadText}>Re-upload</Text>
            </Pressable>
          )}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleWebFile}
              style={{ display: 'none' }}
            />
          )}
        </View>
        <Pressable onPress={handleClear} disabled={busy !== null} style={styles.clearBtn}>
          {busy === 'clear'
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Feather name="x" size={16} color={colors.textSecondary} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderRadius: radius['2xl'], padding: spacing[4], gap: spacing[2] },
  label: { fontFamily: typography.sansBold, fontSize: 10, letterSpacing: 1, color: colors.textSecondary },
  hint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary },
  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[3],
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.primaryBorder,
    backgroundColor: colors.primarySurface, marginTop: spacing[2],
  },
  pickBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.primary },
  attachedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  thumbWrap: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: 48, height: 48 },
  attachedInfo: { flex: 1, gap: 2 },
  attachedTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  attachedTitle: { flex: 1, fontFamily: typography.sansSemiBold, fontSize: fontSize.sm },
  reUploadHint: { alignSelf: 'flex-start' },
  reUploadText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: '#B45309', textDecorationLine: 'underline' },
  clearBtn: { padding: 4 },
});
```

- [ ] **Step 3: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```

If `tsc` complains about JSX `<input>` in a `.tsx` file targeting React Native (which doesn't know about HTMLInputElement), wrap the web-only render in `Platform.OS === 'web'` (already done) — TypeScript checks JSX literals against React.JSX, and `<input>` is a valid HTML element so this should typecheck. If you see errors about `React.ChangeEvent` not being found, add `import * as React from 'react';` at the top.

- [ ] **Step 4: Commit**

```
git add src/components/payment/ProofUpload.tsx
git commit -m "feat(payment): ProofUpload component with platform-branched picker"
```

---

## Task 11: Wire `ProofUpload` into participant page

**Files:**
- Modify: `app/p/[token].tsx`

- [ ] **Step 1: Import the component**

At the top of `app/p/[token].tsx`, after the existing `import { SlideToConfirm } from '../../src/components/payment/SlideToConfirm';` line, add:

```ts
import { ProofUpload } from '../../src/components/payment/ProofUpload';
```

- [ ] **Step 2: Replace any existing placeholder with the new component**

Find the JSX block between the payment instructions card and the swipe block (search for `{canSwipe && (` to locate). Insert above the `{canSwipe && (` block:

```tsx
      <ProofUpload
        token={token!}
        organizerName={organizer.displayName}
        proofUrl={participant.proofUrl}
        proofSummary={participant.proofSummary}
        proofExtracted={participant.proofExtracted}
        onChanged={load}
      />
```

The `token` value comes from `useLocalSearchParams<{ token: string }>()` at the top of the component — already in scope as the `token` variable. `load` is also already defined.

- [ ] **Step 3: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Smoke-test on web**

```
NODE_ENV=development npm run web
```

Visit `http://localhost:8081/p/<a-valid-token>` in an incognito tab. Expected: the proof upload block now appears between payment instructions and the swipe bar. Tap "Choose receipt screenshot" → native file picker opens.

- [ ] **Step 5: Commit**

```
git add "app/p/[token].tsx"
git commit -m "feat(p): wire ProofUpload into participant page"
```

---

## Task 12: `AISummaryBanner` component (+ `getMatchLevel`)

**Files:**
- Create: `src/components/payment/AISummaryBanner.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/payment/AISummaryBanner.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import { supabase } from '../../lib/supabase';
import type { ProofExtraction } from '../../types';

export type MatchLevel = 'high' | 'medium' | 'none';

export function getMatchLevel(extracted: ProofExtraction | undefined): MatchLevel {
  if (!extracted || !extracted.matchesExpected) return 'none';
  return extracted.confidence >= 0.9 ? 'high' : 'medium';
}

interface Props {
  proofUrl?: string;
  proofSummary?: string;
  proofExtracted?: ProofExtraction;
  onImageTap: (signedUrl: string) => void;
}

type BannerVariant = 'matchHigh' | 'matchMedium' | 'mismatch' | 'unread';

function variantOf(extracted?: ProofExtraction): BannerVariant {
  if (!extracted) return 'unread';
  if (!extracted.matchesExpected) return 'mismatch';
  return extracted.confidence >= 0.9 ? 'matchHigh' : 'matchMedium';
}

const TINTS: Record<BannerVariant, { bg: string; icon: string; label: string }> = {
  matchHigh:   { bg: '#D1FAE5', icon: '#059669', label: '#065F46' },
  matchMedium: { bg: '#ECFDF5', icon: '#059669', label: '#065F46' },
  mismatch:    { bg: '#FEF3C7', icon: '#B45309', label: '#92400E' },
  unread:      { bg: colors.gray100, icon: colors.textSecondary, label: colors.textPrimary },
};

const ICONS: Record<BannerVariant, keyof typeof Feather.glyphMap> = {
  matchHigh:   'check-circle',
  matchMedium: 'check-circle',
  mismatch:    'alert-triangle',
  unread:      'info',
};

export function AISummaryBanner({ proofUrl, proofSummary, proofExtracted, onImageTap }: Props) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!proofUrl) { setThumbUrl(null); return; }
      const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60);
      if (!cancelled && data && !error) setThumbUrl(data.signedUrl);
    }
    void load();
    return () => { cancelled = true; };
  }, [proofUrl]);

  // Hide entirely if there's no proof
  if (!proofUrl) return null;

  const variant = variantOf(proofExtracted);
  const tint = TINTS[variant];

  const handleTap = async () => {
    if (!proofUrl) return;
    // Fetch a fresh signed URL just for the viewer (independent of the thumb's TTL)
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60);
    if (data && !error) onImageTap(data.signedUrl);
  };

  return (
    <Pressable onPress={handleTap} style={[styles.root, { backgroundColor: tint.bg }]}>
      <View style={styles.thumbWrap}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <ActivityIndicator color={tint.icon} />
        )}
      </View>
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Feather name={ICONS[variant]} size={14} color={tint.icon} />
          <Text style={[styles.summary, { color: tint.label }]} numberOfLines={3}>
            {proofSummary ?? 'Proof attached — tap to view'}
          </Text>
        </View>
        <Text style={[styles.viewHint, { color: tint.label }]}>Tap to view full receipt</Text>
      </View>
      <Feather name="chevron-right" size={16} color={tint.icon} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], borderRadius: radius.xl,
  },
  thumbWrap: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.gray100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumb: { width: 44, height: 44 },
  info: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summary: { flex: 1, fontFamily: typography.sansSemiBold, fontSize: fontSize.sm },
  viewHint: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, opacity: 0.75 },
});
```

- [ ] **Step 2: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 3: Commit**

```
git add src/components/payment/AISummaryBanner.tsx
git commit -m "feat(payment): AISummaryBanner with getMatchLevel helper"
```

---

## Task 13: Image viewer modal in PaymentReviewSheet

**Files:**
- Modify: `src/components/payment/PaymentReviewSheet.tsx`

- [ ] **Step 1: Add image viewer modal state + render**

Open `src/components/payment/PaymentReviewSheet.tsx`. At the top of the function body (after the existing `useState` lines), add:

```ts
const [viewerUrl, setViewerUrl] = useState<string | null>(null);
```

Just before the existing closing `</Modal>` of the main sheet (search for `</Modal>`), add a SECOND Modal sibling for the image viewer. Since the sheet itself is wrapped in a Modal, the viewer needs to be a sibling at the same level. The cleanest approach: render the viewer in a fragment.

Restructure the return so it looks like this (preserve the existing Modal — just wrap both in a Fragment):

```tsx
  return (
    <>
      <Modal animationType="slide" transparent onRequestClose={onClose}>
        {/* ... existing sheet content unchanged ... */}
      </Modal>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
          {viewerUrl && (
            <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />
          )}
          <Pressable onPress={() => setViewerUrl(null)} style={styles.viewerClose}>
            <Feather name="x" size={24} color="#FFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
```

Add the needed imports at the top if missing: `Image` from `react-native`.

- [ ] **Step 2: Add the viewer styles**

In the existing `StyleSheet.create({...})` block, add:

```ts
  viewerBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center', justifyContent: 'center',
  },
  viewerImage: { width: '90%', height: '90%' },
  viewerClose: {
    position: 'absolute', top: 40, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
```

- [ ] **Step 3: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 4: Commit**

```
git add src/components/payment/PaymentReviewSheet.tsx
git commit -m "feat(payment): image viewer modal in PaymentReviewSheet"
```

---

## Task 14: Wire `AISummaryBanner` + Approve pulse

**Files:**
- Modify: `src/components/payment/PaymentReviewSheet.tsx`

- [ ] **Step 1: Import banner + match-level helper**

Add to the top imports of `src/components/payment/PaymentReviewSheet.tsx`:

```ts
import { AISummaryBanner, getMatchLevel } from './AISummaryBanner';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';
import { useEffect } from 'react';
```

(The `useEffect` import joins your existing `useState` import — combine them in the existing `import { useState } from 'react';` statement.)

- [ ] **Step 2: Compute match level + drive pulse**

Just after the `const [reason, setReason] = useState('');` line, add:

```ts
const matchLevel = getMatchLevel(participant?.proofExtracted);
const pulse = useSharedValue(1);

useEffect(() => {
  if (matchLevel === 'high') {
    pulse.value = withRepeat(withTiming(1.05, { duration: 700 }), -1, true);
  } else {
    cancelAnimation(pulse);
    pulse.value = withTiming(1);
  }
  return () => { cancelAnimation(pulse); };
}, [matchLevel, pulse]);

const approveAnimatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: pulse.value }],
}));
```

- [ ] **Step 3: Insert banner above the meta line**

Find the existing JSX block:

```tsx
{participant.submittedAt && (
  <Text style={styles.meta}>
    Submitted {new Date(participant.submittedAt).toLocaleString()}
  </Text>
)}
```

INSERT this block ABOVE it:

```tsx
<AISummaryBanner
  proofUrl={participant.proofUrl}
  proofSummary={participant.proofSummary}
  proofExtracted={participant.proofExtracted}
  onImageTap={setViewerUrl}
/>
```

- [ ] **Step 4: Wrap the Approve Pressable with Animated.View**

Find the existing Approve `<Pressable style={[styles.btn, styles.approveBtn]} ...>...</Pressable>` and wrap it:

```tsx
<Animated.View style={[{ flex: 1 }, approveAnimatedStyle]}>
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
</Animated.View>
```

Note: the outer `Animated.View` takes `flex: 1` so the button still fills its row (the original Pressable had `flex: 1` via `styles.btn`).

- [ ] **Step 5: Verify typecheck**

```
NODE_ENV=development npx tsc --noEmit
```
Expected: clean.

- [ ] **Step 6: Smoke-test the organizer flow**

```
NODE_ENV=development npm run web
```

1. Open the dashboard or bill detail in a normal browser tab (organizer signed in).
2. Open `/p/<token>` in an incognito tab.
3. In incognito, upload any image as proof. Observe the participant-side feedback.
4. In incognito, swipe to confirm.
5. In the organizer tab, click the participant row to open `PaymentReviewSheet`.
6. Banner should be visible. If the scan returned `matchesExpected: true` AND `confidence >= 0.9`, the Approve button should pulse.
7. Tap the banner. Full-screen image viewer opens. Tap ✕ to close.
8. Tap Approve. Status flips to paid (already-existing flow).

- [ ] **Step 7: Commit**

```
git add src/components/payment/PaymentReviewSheet.tsx
git commit -m "feat(payment): AISummaryBanner + pulse on high-confidence Approve"
```

---

## Task 15: E2E manual verification

**Files:** none (verification only)

- [ ] **Step 1: Reset a participant**

Via the Supabase MCP or dashboard:
```sql
UPDATE participants
SET payment_status='unpaid', submitted_at=NULL, confirmed_at=NULL,
    proof_url=NULL, proof_extracted=NULL, proof_summary=NULL, rejected_reason=NULL
WHERE name='aiman';
```

- [ ] **Step 2: Test match path**

Open `/p/<aiman's token>` in incognito. Use a screenshot of a payment receipt with the EXACT amount matching aiman's share. Upload. Expected:
- ProofUpload shows "Reading receipt…" then flips to green "Receipt … matches expected ✓"
- Verify: `SELECT proof_extracted, proof_summary FROM participants WHERE name='aiman';` shows `matchesExpected: true`, confidence high, summary line matches

Swipe to confirm. Open organizer's PaymentReviewSheet for aiman. Expected:
- Banner is green with summary
- Approve button pulses gently
- Tap banner → full-screen image opens

Tap Approve. Participant tab flips to green Paid ✓ via Realtime.

- [ ] **Step 3: Test mismatch path**

Reset aiman (same SQL as Step 1). Upload a receipt with a DIFFERENT amount (e.g. RM 5 when aiman owes RM 12.72). Expected:
- ProofUpload flips to amber "Receipt … shows RM 5.00 — expected RM 12.72"
- "Re-upload" hint button appears
- Banner in organizer's sheet is amber, no Approve pulse

- [ ] **Step 4: Test unread / low-confidence path**

Reset aiman. Upload a blurry photo or a random non-receipt image. Expected:
- ProofUpload flips to grey "Couldn't read clearly — organizer will check manually"
- Banner in organizer's sheet is grey

- [ ] **Step 5: Test re-upload after reject**

Reset aiman. Upload mismatch image. Swipe. Open organizer sheet. Reject with reason "Wrong amount". Back in incognito, swipe-bar is enabled with red "Payment couldn't be confirmed" + reason. Re-upload a matching receipt. Expected:
- New summary line replaces old
- `SELECT proof_url FROM participants WHERE name='aiman';` returns the SAME path (`payment-proofs/{pid}/proof.jpg` etc) — upsert replaced the file
- Swipe again, organizer approves, flow completes

- [ ] **Step 6: Test ✕ remove**

In any state with a proof attached, tap ✕. Expected:
- Proof block collapses back to idle "Choose receipt screenshot"
- DB row: all three proof fields are NULL
- Storage object still exists at the same path (cleanup is Layer D — intentional)

- [ ] **Step 7: Test scan-service failure soft path**

Temporarily clear the Gemini quota by hitting the function 30+ times (or remove GEMINI_API_KEY in Supabase secrets briefly). Upload an image. Expected:
- Toast "AI scan unavailable, you can still confirm without proof"
- No proof saved (db fields stay NULL, storage object NOT created)
- Slide bar still works — submit_payment succeeds without proof

Restore the key after the test.

- [ ] **Step 8: Tag the milestone**

```
git tag participant-payment-layer-a-v1
git log --oneline participant-payment-core-v1..HEAD | head -20
```

---

## Open Items (Deferred to Later Layers)

- **Storage orphan cleanup** — Layer D
- **Bill-cancelled state on participant page** — Layer D
- **Per-token rate limiting** — Layer D (currently per-IP only)
- **Layers B (chat), C (delight bundle), D (hardening)** — separate plans

### Test infrastructure not added in this plan

The spec §10 lists two test buckets that this plan does NOT add tasks for:

- **Edge function tests via `deno test`** — the project has no local Deno runtime configured. The smoke-test via curl in Task 5 substitutes for v1. If you want unit-level coverage of `buildSummary`, `extToMime`, etc., extract them into `_shared/proof.ts` later and write tests once Deno is set up locally.
- **React component tests via @testing-library/react-native** — the project has only one logic test file (`reportsCompute.test.ts`) and no `@testing-library/react-native` installed. Adding RTL would be its own multi-step setup (install + jest config + first test). For Layer A, the manual E2E in Task 15 covers the integration paths that matter. If you want unit coverage for `getMatchLevel` and `buildSummary` (cheap, pure functions), they could land in `src/components/payment/__tests__/utils.test.ts` as a small follow-up.

---

**End of Layer A plan.**
