# Participant Payment Flow — Layer A: Trust & Verification — Design Spec

**Date:** 2026-06-01
**Status:** Approved for implementation
**Parent spec:** `2026-06-01-participant-payment-flow-design.md`
**Layer:** A of {A, B, C, D}

---

## 1. Problem & Goal

The core participant payment flow (shipped on `feature/participant-payment-core`) lets a participant swipe to confirm and an organizer manually approve. The organizer has no information beyond "they said they paid" — no proof, no automatic amount-matching. Reviewing twenty participants means twenty manual checks against whatever WhatsApp screenshot the participant later sends.

**Goal:** Let the participant optionally attach a payment receipt directly on their `/p/{token}` page. Gemini reads the receipt, extracts amount + reference + bank, compares against expected, and surfaces a one-line summary to the organizer's review sheet. Match → green pulse on Approve. Mismatch → amber warning with expected vs read. The organizer always taps Approve manually — AI is a guide, not an auto-approver.

## 2. Scope

**In scope:**
- New private Supabase Storage bucket `payment-proofs`
- Migration 010 adding `participants.proof_extracted JSONB` + `participants.proof_summary TEXT` + `clear_payment_proof` RPC
- New edge function `scan-payment-proof` (upload + scan + DB write in one round trip)
- New `ProofUpload` component on participant page (between payment instructions and slide bar)
- New `AISummaryBanner` component inside organizer's `PaymentReviewSheet`
- Image viewer modal on banner tap (signed-URL fetch)
- Rate limiting via existing `_shared/gemini.ts` `checkRateLimit` (per-IP, 5/min)

**Explicitly NOT in this slice:**
- Auto-approve based on AI confidence — organizer always taps Approve (locked in during brainstorming)
- Multi-image / history of past proofs — replace-wins (locked in during brainstorming)
- Separate `create-proof-upload-url` edge function from the parent spec — Approach A merges upload + scan
- Image preprocessing (resize, EXIF strip) beyond what `expo-image-picker` already does
- Storage object lifecycle / orphan cleanup — deferred to Layer D Hardening
- Per-token rate limiting (only per-IP for now)

**Out of scope:**
- Layers B (chat), C (delight bundle), D (hardening) — separate specs

## 3. Architecture

The flow is a single edge-function round trip per upload. Client picks an image, base64-encodes it, sends to `scan-payment-proof` with the access token. The edge function validates, calls Gemini, computes match against expected amount, uploads the image to private Storage, and atomically updates the participant row. The Realtime subscription on the participant row delivers the new `proof_summary` to both the participant's own page and any open organizer review sheet — no separate notification path needed.

```
Participant page (web/mobile)
   │
   │  POST { token, imageBase64, mimeType }
   ▼
┌──────────────────────────────────────────────┐
│  scan-payment-proof (edge function)          │
│                                              │
│  1. Validate token → SELECT participant      │
│  2. Validate image (size, MIME)              │
│  3. Call Gemini → extracted JSON             │
│  4. Compute matchesExpected (±RM 0.10)       │
│  5. Build human summary string               │
│  6. Upload to payment-proofs/{pid}/proof.ext │
│  7. UPDATE participants SET proof_url,       │
│       proof_extracted, proof_summary         │
│  8. Return { summary, extracted, proofUrl }  │
└──────────────────────────────────────────────┘
   │                              │
   │ Response → ProofUpload UI    │ Realtime UPDATE broadcast
   ▼                              ▼
Participant sees "Looks right ✓"  Organizer's PaymentReviewSheet
                                  shows AISummaryBanner if open
```

The slide-to-confirm bar's behaviour does not change — participant can swipe at any time, with or without proof. `submit_payment` already preserves any existing `proof_url` it sees (the spec uses `COALESCE(p_proof_url, proof_url)`), so the scan and the swipe compose cleanly regardless of order.

## 4. Data Model

### 4.1 Migration `010_proof_intelligence.sql`

```sql
-- Migration 010: Layer A — proof intelligence
-- Adds: proof_extracted JSONB + proof_summary TEXT on participants
-- Adds: clear_payment_proof RPC for participant-side cleanup
-- Storage bucket payment-proofs is created via Supabase dashboard or a
-- separate seed (idempotent INSERT INTO storage.buckets below).

ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS proof_extracted JSONB,
  ADD COLUMN IF NOT EXISTS proof_summary   TEXT;

-- Storage bucket: private, organizer reads via signed URLs only
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Anyone with the participant token can clear their own proof.
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

  -- Storage object intentionally NOT deleted here. Daily cleanup job
  -- (Layer D) will reap orphaned files. Overwrites are safe because
  -- the path is deterministic (one file per participant).

  RETURN json_build_object('id', v_pid, 'cleared', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clear_payment_proof(UUID) TO anon, authenticated;
```

### 4.2 `proof_extracted` JSONB shape

```ts
interface ProofExtraction {
  amount: number | null;          // RM amount Gemini read
  currency: string | null;        // "MYR" usually
  reference: string | null;       // e.g. "TXN20260601A3F2"
  bank: string | null;            // e.g. "Maybank", "Touch 'n Go eWallet"
  date: string | null;            // YYYY-MM-DD
  confidence: number;             // 0..1
  matchesExpected: boolean;       // computed: conf>=0.7 && |amount - expected| <= 0.10
}
```

### 4.3 `proof_summary` content rules

The edge function builds the summary string before persisting. The participant page and the organizer's `AISummaryBanner` both render this string verbatim — no client-side re-templating.

| Case | Summary text |
|------|--------------|
| `confidence >= 0.7` && match | `"Receipt from {bank}, RM {amount.toFixed(2)}, ref {reference} — matches expected ✓"` |
| `confidence >= 0.7` && no match | `"Receipt from {bank} shows RM {amount.toFixed(2)} — expected RM {expected.toFixed(2)}"` |
| `confidence < 0.7` | `"Could not read amount confidently — please review manually"` |

Missing `bank` → omit the `"from {bank}"` clause. Missing `reference` → omit the `, ref …` clause.

### 4.4 TypeScript types (extend `src/types/index.ts`)

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

// Extend existing Participant
export interface Participant {
  // ... existing fields ...
  proofExtracted?: ProofExtraction;
  proofSummary?: string;
}

// Extend ParticipantView returned by get_participant_view
//
// NOTE: get_participant_view's SQL also gains proofExtracted and
// proofSummary in its participant sub-object (migration 010 step).
export interface ParticipantView {
  participant: {
    // ... existing fields ...
    proofExtracted?: ProofExtraction;
    proofSummary?: string;
  };
  // ... rest unchanged ...
}
```

`get_participant_view` from migration 008 needs to be redefined inside migration 010 to include the two new fields in its `json_build_object`. The function is `CREATE OR REPLACE` so this is idempotent and additive.

### 4.5 `getOrganizerBills` SELECT — add new columns

In `src/lib/supabase.ts`, the existing SELECT in `getOrganizerBills` adds two columns to the `participants` sub-select:

```ts
participants (
  id, name, email, phone, amount, is_paid, paid_at, avatar_color, shares, percent,
  access_token, payment_status, proof_url, submitted_at, confirmed_at, rejected_reason,
  proof_extracted, proof_summary
)
```

This mirrors the fix we already made for the migration-008 columns.

### 4.6 `mapParticipantRow` — read new fields

In `src/store/billStore.ts` `mapParticipantRow`, add:

```ts
proofExtracted: (p['proof_extracted'] as ProofExtraction | undefined) ?? undefined,
proofSummary:   (p['proof_summary']   as string         | undefined) ?? undefined,
```

## 5. Edge Function `scan-payment-proof`

Lives at `supabase/functions/scan-payment-proof/index.ts`. Follows the exact structural pattern of the existing `gemini-scan-receipt` for consistency.

### 5.1 Request and response shape

```ts
// Request body
{
  token: string;          // UUID, participant access_token
  imageBase64: string;    // raw or data-URI ("data:image/jpeg;base64,…")
  mimeType: string;       // "image/jpeg" | "image/png" | "image/webp"
}

// Response (200 in both cases — client distinguishes on `success`)
{
  success: true;
  summary: string;
  extracted: ProofExtraction;
  proofUrl: string;       // storage path "payment-proofs/{pid}/proof.jpg"
}
// or
{
  success: false;
  error: string;          // user-facing message
}
```

### 5.2 Algorithm

1. **CORS preflight** — reuse `corsHeaders`.
2. **Validate Gemini key** is present; bail 500 if not.
3. **Per-IP rate limit** via `checkRateLimit(ip)` — 5/min, same as `gemini-scan-receipt`. Beyond limit → 429.
4. **Parse + validate request body**:
   - `token` parses as a UUID
   - `mimeType` ∈ {`image/jpeg`, `image/png`, `image/webp`}
   - Strip data-URI prefix from `imageBase64` if present
   - Byte length (computed from base64) ≤ 4 MB; reject 400 otherwise
5. **Look up participant** via service-role Supabase client:
   ```sql
   SELECT id, bill_id, amount FROM participants WHERE access_token = $1
   ```
   No row → 404 with `error: 'Invalid token'`. Don't burn a Gemini call.
6. **Call Gemini** with the proof-specific prompt below; `temperature: 0.1`, `maxOutputTokens: 800`, `responseMimeType: 'application/json'`.
7. **Parse JSON response** via `extractJson` helper. If invalid → soft fail (return `{ success: false, error: 'Could not read receipt' }`). Image is NOT uploaded.
8. **Compute `matchesExpected`**:
   ```ts
   const matchesExpected =
     extracted.confidence >= 0.7 &&
     typeof extracted.amount === 'number' &&
     Math.abs(extracted.amount - expectedAmount) <= 0.10;
   ```
9. **Build `summary`** per §4.3 rules.
10. **Upload to Storage** using service-role client:
    ```ts
    supabase.storage
      .from('payment-proofs')
      .upload(`${participantId}/proof.${ext}`, bytes, {
        contentType: mimeType,
        upsert: true,
      });
    ```
    `ext` derived from `mimeType` (`jpeg → jpg`, `png → png`, `webp → webp`).
11. **Update participants row**:
    ```sql
    UPDATE participants
    SET proof_url       = $1,
        proof_extracted = $2,
        proof_summary   = $3
    WHERE id = $4
    ```
12. **Return** `{ success: true, summary, extracted, proofUrl }`.

If Storage upload (step 10) fails: don't write step 11; return `{ success: false, error: 'Upload failed' }`. The user can retry.

### 5.3 Gemini prompt

```
You are analysing a Malaysian bank transfer or e-wallet payment receipt
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
- For unreadable strings use null. For unreadable amount use 0.
```

### 5.4 Error handling (edge function side)

| Failure | HTTP | Response | Side effects |
|---------|------|----------|--------------|
| Missing `GEMINI_API_KEY` | 500 | `error: 'Scan service not configured'` | none |
| Rate limit exceeded | 429 | `error: 'Slow down, try again in a minute'` | none |
| Missing token / not found | 404 | `error: 'Invalid token'` | none |
| Wrong MIME type | 400 | `error: 'Use JPG, PNG, or WebP'` | none |
| Image > 4 MB | 400 | `error: 'Image too large (max 4 MB)'` | none |
| Gemini quota / 429 | 200 | `success: false, error: 'AI scan unavailable, you can still confirm without proof'` | none — no upload, no DB write |
| Gemini malformed JSON | 200 | `success: false, error: 'Could not read receipt'` | none |
| Storage upload fails | 200 | `success: false, error: 'Upload failed, try again'` | none |
| Postgres UPDATE fails | 200 | `success: false, error: 'Could not save'` | storage object exists (orphan; reaped by Layer D) |

All failures are logged server-side via `console.error` with the participant ID (never the image bytes).

## 6. Client Wrapper

In `src/lib/supabase.ts`:

```ts
export async function scanPaymentProof(
  token: string,
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<
  | { success: true; summary: string; extracted: ProofExtraction; proofUrl: string }
  | { success: false; error: string }
> {
  const { data, error } = await supabase.functions.invoke('scan-payment-proof', {
    body: { token, imageBase64, mimeType },
  });
  if (error) return { success: false, error: error.message };
  return data;
}

export async function clearPaymentProof(token: string): Promise<{ cleared: boolean }> {
  const { data, error } = await supabase.rpc('clear_payment_proof', { p_token: token });
  if (error) throw error;
  return data;
}
```

## 7. UI Components

### 7.1 `ProofUpload` (`src/components/payment/ProofUpload.tsx`)

Replaces the existing simple "Add proof of payment (optional)" placeholder in the participant page with a full-featured upload + scan + display block.

**Props:**
```ts
interface Props {
  token: string;
  organizerName: string;
  proofUrl?: string;
  proofSummary?: string;
  proofExtracted?: ProofExtraction;
  onUploaded: () => void; // Caller (page) reloads participant view
}
```

**States:**

| State | Trigger | Render |
|-------|---------|--------|
| `idle` | no `proofUrl` and not in flight | Prompt card with "Attach proof of payment" + camera icon. Tap → file picker. |
| `picking` | file picker open | parent state, transient |
| `uploading` | request in flight | Thumbnail with overlay spinner + "Reading receipt…" caption |
| `match` | `proofExtracted.matchesExpected === true` | Thumbnail + green check + `proofSummary` line + ✕ |
| `mismatch` | `proofExtracted.matchesExpected === false` && confidence ≥ 0.7 | Thumbnail + amber alert + `proofSummary` + ✕ + "Re-upload?" hint button |
| `unread` | confidence < 0.7 OR `proofExtracted == null` but `proofUrl != null` | Thumbnail + grey info icon + "Couldn't read clearly — organizer will check manually" + ✕ |
| `error` | last call returned `success: false` | Error toast + reverts to `idle` |

**Image picking — platform branched:**

Web:
```tsx
<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPick} />
<Pressable onPress={() => fileRef.current?.click()}>...</Pressable>
```

Mobile (`expo-image-picker`):
```ts
const r = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  quality: 0.7,
  base64: true,
  allowsEditing: true,
});
if (!r.canceled) { /* read r.assets[0].base64 + .mimeType */ }
```

Web path reads the `File` via `FileReader.readAsDataURL`, strips the prefix client-side (edge fn also handles either form).

**Removing** (✕): call `clearPaymentProof(token)`, then `onUploaded()` so parent reloads.

### 7.2 `AISummaryBanner` (`src/components/payment/AISummaryBanner.tsx`)

Renders the banner at the top of `PaymentReviewSheet`'s body, above the existing "Submitted {timestamp}" line.

**Props:**
```ts
interface Props {
  proofUrl?: string;
  proofSummary?: string;
  proofExtracted?: ProofExtraction;
  onImageTap: () => void;
}
```

**Variants:**

| Condition | Background | Icon | Border / accent |
|-----------|------------|------|-----------------|
| `proofExtracted?.matchesExpected === true` && `confidence >= 0.9` | green-100 | check-circle green-700 | pulses Approve button via callback prop (see below) |
| `proofExtracted?.matchesExpected === true` && `confidence < 0.9` | green-50 | check-circle green-600 | no pulse |
| `proofExtracted?.matchesExpected === false` | amber-100 | alert-triangle amber-700 | no pulse |
| `proofExtracted == null` && `proofUrl != null` | grey-100 | info grey-600 | no pulse |
| `proofUrl == null` | render nothing (banner is conditional) | — | — |

Text content = `proofSummary` verbatim. The component renders a small thumbnail of the proof image (using `proofUrl` → `supabase.storage.from('payment-proofs').createSignedUrl(proofUrl, 60)`). Tapping the banner calls `onImageTap` which opens a full-screen Modal viewer in the parent.

To request the Approve-button pulse, the banner exports a pure helper `getMatchLevel(extracted) → 'high' | 'medium' | 'none'` that the parent calls directly when rendering Approve. `high` = `matchesExpected && confidence >= 0.9`; `medium` = `matchesExpected && confidence < 0.9`; `none` otherwise. The parent drives the pulse animation off `matchLevel === 'high'` with `react-native-reanimated`'s `withRepeat(withTiming(...))`. Co-locating the level computation in the banner module keeps the "AI confidence policy" in one place.

### 7.3 Image viewer modal (inline in `PaymentReviewSheet`)

When organizer taps the banner, a full-screen Modal opens with:
- The proof image at full width, contained
- ✕ button top-right to close
- Pinch-to-zoom is NICE-TO-HAVE; for v1 we use a static contained image

The signed URL for the image is generated when the modal opens (60s TTL), not when the sheet opens, to keep token use lazy.

### 7.4 Wiring

- `app/p/[token].tsx` — replace the existing placeholder upload section with `<ProofUpload ... />`. Pass `token`, `view.organizer.displayName`, and `view.participant.*` fields. `onUploaded` calls `load()` (already defined).
- `src/components/payment/PaymentReviewSheet.tsx` — add `<AISummaryBanner ... />` at the top of the sheet body. Hold modal-open state and signed URL fetching here.

## 8. Realtime

No changes needed. The Realtime subscription on `participants` (enabled in migration 009 with `REPLICA IDENTITY FULL`) already broadcasts every `UPDATE`, so when the edge function writes `proof_summary`, both the participant page and any open organizer review sheet receive the change and re-render via the existing reload paths.

## 9. Error Handling Summary

(Full table in Section 5.4; this is the user-facing summary.)


| Scenario | User sees |
|----------|-----------|
| Image too large | Inline "Image too large, max 4 MB" before upload |
| Wrong format | Inline "JPG, PNG, or WebP only" |
| AI scan fails (quota / parse) | Toast "AI scan unavailable, you can still confirm without proof"; no proof saved |
| Network failure | "Couldn't upload, retry?" inline button |
| Token invalid (shouldn't happen since participant is already on the page) | Generic error toast; page is reloaded |
| Organizer reviews mid-scan | Grey "Scan in progress…" banner until result arrives via Realtime |

## 10. Testing

**SQL/RPC tests** (`supabase/tests/010_proof_intelligence.test.sql`):
- `clear_payment_proof(valid)` nulls all three columns
- `clear_payment_proof(invalid)` raises
- `get_participant_view` returns `proofExtracted` + `proofSummary` when set
- `get_participant_view` returns nulls for those fields when unset

**Edge function tests** (`supabase/functions/scan-payment-proof/test.ts`):
- Mock Gemini → match path → assertions on DB row + storage object presence
- Mock Gemini → mismatch path → summary contains "expected RM"
- Mock Gemini → low confidence → summary is the "could not read" line
- Mock Gemini → 429 → response `success: false`, no DB write, no storage write
- Invalid token → 404, no Gemini call
- Oversized base64 → 400, no Gemini call

**Component tests** (`src/components/payment/__tests__/`):
- `ProofUpload` renders idle → picking → uploading → match/mismatch/unread states from props
- `ProofUpload` ✕ calls `clearPaymentProof` then `onUploaded`
- `AISummaryBanner` 4 visual variants snapshot correctly
- `AISummaryBanner` `onImageTap` invoked on press

**E2E manual checklist:**
1. Upload Maybank screenshot with exact bill amount → green "matches expected ✓" within ~3s
2. Upload receipt with wrong amount → amber banner shows expected vs read
3. Upload blurry / non-receipt image → grey "couldn't read clearly"
4. Re-upload after organizer reject → old proof replaced (verify in Storage dashboard)
5. Open organizer review sheet → banner shows correct variant, image opens via tap, signed URL works
6. Submit without proof → banner hidden, organizer reviews manually as before

## 11. Rollout & Implementation Order

1. **Migration 010** — schema + RPC + `get_participant_view` redefinition + bucket
2. **`scan-payment-proof` edge function** + deploy
3. **TS types** — add `ProofExtraction`, extend `Participant`, extend `ParticipantView`
4. **Client wrappers** — `scanPaymentProof`, `clearPaymentProof` in `src/lib/supabase.ts`
5. **`getOrganizerBills` SELECT** — add the two new columns
6. **`mapParticipantRow`** — read the two new fields
7. **`ProofUpload` component** with platform-branched image picker
8. **Wire into `app/p/[token].tsx`** — replace placeholder, test full participant flow
9. **`AISummaryBanner` component** with signed-URL thumbnail
10. **Image viewer modal** in `PaymentReviewSheet`
11. **Wire banner into `PaymentReviewSheet`**, test organizer flow
12. **Tests** — SQL, edge fn, components
13. **E2E manual checklist**

Steps 1–6 ship the backend + types; steps 7–13 ship the UI. Backend can be deployed first; participant page falls back to the existing placeholder until UI ships.

## 12. Open Risks

- **Gemini receipt quality varies wildly** between Malaysian banks. The prompt is tuned for what we've seen, but a new bank format may read poorly. The `confidence < 0.7` grey fallback is the safety net — organizer always reviews manually if AI is unsure.
- **Storage orphans accumulate** if participants re-upload often. Acceptable for MVP; daily cleanup is a Layer D task.
- **AI banner pulses Approve when match is high** — could nudge organizer to over-trust the AI. We accept this trade-off because the alternative (no nudge) makes the AI feel useless. Organizer education: "AI is a hint, not a verdict."
- **Edge fn 4 MB cap** — modern phone screenshots can exceed 4 MB on some devices. `expo-image-picker` `quality: 0.7` keeps them comfortably under, but the web file picker doesn't. Acceptable: clear error message tells user to take a smaller screenshot.

---

**End of Layer A spec.**
