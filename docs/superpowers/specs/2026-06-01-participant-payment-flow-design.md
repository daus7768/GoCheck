# Participant Payment Flow — Design Spec

**Date:** 2026-06-01
**Status:** Approved for implementation
**Author:** GoCheck team

---

## 1. Problem & Goal

Today, an organizer creates a bill and gets a single shared link (`gocheck.app/invoice/{token}` or `gocheck.app/bill/{code}`). Anyone with the link sees every participant and can mark anyone as paid. There is no privacy, no per-person accountability, no proof of payment, and no way for a participant to talk back to the organizer without leaving the app.

**Goal:** Each participant gets their own unique URL. Opening it shows only their share. They confirm payment (with optional proof) via a swipe gesture. The organizer reviews and approves. A lightweight message thread connects them. Participants never need to sign up.

## 2. Scope

**In scope:**
- Per-participant access tokens stored on the `participants` table
- A new public web page `app/p/[token].tsx` rendered by Expo Web
- Two-step payment state machine: `unpaid → pending → confirmed | rejected`
- Optional proof-of-payment image upload to a new Supabase Storage bucket
- **Gemini-powered proof intelligence** — auto-extract amount + reference, auto-match expected amount, surface a one-line summary to organizer
- **Locally-generated DuitNow QR code** — rendered client-side from organizer's payment details, no third-party QR API
- Slide-to-confirm payment submission with confetti + shareable receipt card on confirmation
- Async message thread with **quick-reply chips** (preset friendly messages) for both sides
- Realtime updates to the participant page when organizer acts
- Anonymized social proof ("3 of 5 friends have paid") on participant page
- **Early-payer badge** when participant confirms before the due date
- Organizer-side approve/reject UI in the existing invoice screen with **coin-drop animation** on the progress bar when a new submission lands
- Extension of `notify-organizer` edge function for new event types

**Explicitly NOT integrating:**
- **No payment gateway, no card processing, no banking API.** Participants pay externally with whatever method the organizer chose; the app only records the trust transaction and proof.
- **No third-party APIs beyond Gemini** (already in the app). All QR generation, animations, and receipt rendering happen client-side.

**Out of scope:**
- Token rotation/revocation (Approach B was rejected as YAGNI)
- Real-time chat with presence (typing indicators, read receipts beyond unread counts)
- Participant accounts or persistent identity
- Removal of the old `app/(modals)/share/[code].tsx` page (kept until later cleanup)

## 2.1 Creative Features (no external APIs)

Everything in this list runs on what we already have: Gemini (already integrated), Supabase Realtime, Reanimated, view-shot, and SVG QR rendering. There is no payment gateway, no banking API, no third-party QR service.

| Feature | What it does | How it works |
|---------|--------------|--------------|
| **Gemini proof scan** | When participant uploads receipt, auto-reads amount + bank reference. Shows "Looks right ✓" if matches expected, "We read RM 22 — double-check?" if off. | Reuses existing `gemini-scan-receipt` edge function (it already extracts amount, currency, date). Result cached in `participants.proof_extracted` and `proof_summary`. |
| **AI summary banner for organizer** | Approval sheet leads with "Receipt from Maybank, RM 25.00, ref TXN-12345 — matches expected ✓". Reduces approval to one glance. | Same scan result, rendered in `PaymentReviewSheet`. If match confidence ≥ 0.9 and amount delta ≤ RM 0.10, banner is green and Approve button pulses. |
| **Confetti on confirmed** | Burst of color when participant page transitions to confirmed via Realtime. | `react-native-confetti-cannon` on mobile, CSS confetti on web. Triggered by status-change effect. |
| **Shareable receipt card** | After confirmation, "Save receipt" button generates a branded PNG with names, amount, timestamp, and a verification QR. | `react-native-view-shot` (mobile) / `html2canvas` (web) snapshots an offscreen styled view. Pure client-side. |
| **Quick-reply chips** | Context-aware preset messages above the composer. `unpaid`: "I'll pay tonight 🙏", `pending`: "Did you get it?", organizer side: "Thanks, confirmed!". | Plain string constants; tap inserts + sends through `post_*_message` RPC. |
| **Anonymized social proof** | Small chip on participant page: "3 of 5 friends have paid". No names, no amounts. | `get_participant_view` already has bill participants count; expose `paid_count` and `total_count`. |
| **Early-payer badge** | "🌟 Early payer — 3 days before due" when participant confirms before due date. | Pure derived value in UI from `confirmed_at` vs `dueDate`. |
| **Coin-drop animation** | When a participant submits, their row in the organizer's invoice screen highlights amber and a 💰 drops into the progress bar. | Reanimated shared values triggered by Realtime status change. |
| **Local DuitNow QR** | If organizer chose `duitnow` and supplied an ID, render a QR locally on the participant page. | `react-native-qrcode-svg`; encodes `duitnow://pay?id={id}&amount={amount}&ref={invoice_number}`. |
| **WhatsApp deep-link share** | Per-participant Share row also offers "Send via WhatsApp" if phone known. | `whatsapp://send?text=...&phone={phone}` URL scheme; OS handles it. No WhatsApp API. |

These are layered on top of the core flow; each is independently shippable.

## 3. Architecture

The participant page is the same Expo Router file rendered by Expo Web (already configured in `app.json` and `package.json`). Same React Native components, same theme tokens. Platform branches handle web-specific affordances (file upload, link sharing).

Token validation is server-side via `SECURITY DEFINER` RPCs. The token is the sole credential — anyone holding it can act as that participant. Organizer-side mutations remain RLS-gated by `auth.uid()`.

```
Participant browser ──https://gocheck.app/p/{token}──→ Expo Web (app/p/[token].tsx)
                                                            │
                                                            │ supabase anon key
                                                            ▼
                                          ┌─────────────────────────────────┐
                                          │  Public RPCs (SECURITY DEFINER) │
                                          │  - get_participant_view         │
                                          │  - submit_payment               │
                                          │  - post_participant_message     │
                                          └────────────┬────────────────────┘
                                                       │
                                                       ▼
                                            ┌────────────────────┐
                                            │ participants       │
                                            │ participant_messages│
                                            │ payments / bills   │
                                            └─────────┬──────────┘
                                                      │ trigger
                                                      ▼
                                       ┌────────────────────────────┐
                                       │ notify-organizer edge fn   │
                                       │ → Expo push to organizer   │
                                       └────────────────────────────┘

Organizer app ──auth session──→ Supabase RLS
              ↳ confirm_payment / reject_payment / post_organizer_message

Realtime channel `participant:{token}` ←──→ participant page (live status updates)
```

## 4. Data Model

### 4.1 Migration `008_participant_payment_flow.sql`

**`participants` table — new columns (idempotent):**

```sql
ALTER TABLE public.participants
  ADD COLUMN IF NOT EXISTS access_token       UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS payment_status     TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','confirmed','rejected')),
  ADD COLUMN IF NOT EXISTS proof_url          TEXT,
  ADD COLUMN IF NOT EXISTS proof_extracted    JSONB,     -- Gemini-extracted { amount, reference, bank, confidence, matches_expected }
  ADD COLUMN IF NOT EXISTS proof_summary      TEXT,      -- one-line summary for organizer
  ADD COLUMN IF NOT EXISTS submitted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason    TEXT;

CREATE INDEX IF NOT EXISTS idx_participants_access_token ON public.participants(access_token);
CREATE INDEX IF NOT EXISTS idx_participants_payment_status ON public.participants(payment_status);

UPDATE public.participants
SET access_token = gen_random_uuid()
WHERE access_token IS NULL;

UPDATE public.participants
SET payment_status = 'confirmed',
    confirmed_at  = COALESCE(paid_at, NOW())
WHERE is_paid = TRUE AND payment_status = 'unpaid';
```

A trigger keeps the legacy `is_paid` / `paid_at` columns in sync with `payment_status` so existing UI continues to work during the migration window:

```sql
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

**New table `participant_messages`:**

```sql
CREATE TABLE IF NOT EXISTS public.participant_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id  UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK (sender IN ('participant','organizer')),
  body            TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pmessages_participant_created
  ON public.participant_messages(participant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pmessages_unread
  ON public.participant_messages(participant_id) WHERE read_at IS NULL;

ALTER TABLE public.participant_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizer_read ON public.participant_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.participants p
      JOIN public.bills b ON b.id = p.bill_id
      WHERE p.id = participant_messages.participant_id
        AND b.organizer_id = auth.uid()
    )
  );

CREATE POLICY organizer_write ON public.participant_messages
  FOR INSERT WITH CHECK (
    sender = 'organizer'
    AND EXISTS (
      SELECT 1 FROM public.participants p
      JOIN public.bills b ON b.id = p.bill_id
      WHERE p.id = participant_messages.participant_id
        AND b.organizer_id = auth.uid()
    )
  );
```

Participant-side writes go through `post_participant_message` RPC, which validates the token.

**Storage bucket `payment-proofs`:**

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT DO NOTHING;
```

Bucket is private. Organizer reads via signed URLs generated server-side. Participant uploads via short-lived signed upload URL returned from `create_proof_upload_url` edge function.

### 4.2 TypeScript types (in `src/types/index.ts`)

```ts
export type PaymentFlowStatus = 'unpaid' | 'pending' | 'confirmed' | 'rejected';

export interface ProofExtraction {
  amount: number | null;
  currency: string | null;
  reference: string | null;
  bank: string | null;
  date: string | null;
  confidence: number;        // 0..1
  matchesExpected: boolean;  // computed: |amount - expected| <= 0.10
}

export interface Participant {
  // existing fields...
  accessToken?: string;
  paymentStatus: PaymentFlowStatus;
  proofUrl?: string;
  proofExtracted?: ProofExtraction;
  proofSummary?: string;
  submittedAt?: string;
  confirmedAt?: string;
  rejectedReason?: string;
}

export interface ParticipantMessage {
  id: string;
  participantId: string;
  sender: 'participant' | 'organizer';
  body: string;
  createdAt: string;
  readAt?: string;
}

export interface ParticipantView {
  participant: {
    id: string;
    name: string;
    amount: number;
    paymentStatus: PaymentFlowStatus;
    proofUrl?: string;
    proofExtracted?: ProofExtraction;
    proofSummary?: string;
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
  messages: ParticipantMessage[];
}
```

## 5. Backend RPCs

All public RPCs are `SECURITY DEFINER` and take the token as the credential. They are added in migration `008_participant_payment_flow.sql`.

```sql
-- Public: participant-side
CREATE OR REPLACE FUNCTION public.get_participant_view(p_token UUID)
  RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Returns { participant, bill, organizer, messages[] }
-- Marks unread organizer-sent messages as read (read_at = now()) for this participant
-- RAISES if token not found, returns null if bill cancelled

CREATE OR REPLACE FUNCTION public.submit_payment(
  p_token     UUID,
  p_proof_url TEXT DEFAULT NULL,
  p_note      TEXT DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Validates token, sets payment_status='pending', submitted_at=now(), proof_url=p_proof_url
-- If p_note non-empty, inserts a participant_messages row (sender='participant')
-- Idempotent: if already 'confirmed', returns { already_confirmed: true } and does nothing
-- If 'rejected', resets rejected_reason to null and moves to 'pending'

CREATE OR REPLACE FUNCTION public.post_participant_message(
  p_token UUID,
  p_body  TEXT
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
-- Validates token, inserts row with sender='participant'

-- Organizer-side (RLS-gated, no SECURITY DEFINER needed)
CREATE OR REPLACE FUNCTION public.confirm_payment(p_participant_id UUID)
  RETURNS json LANGUAGE plpgsql;
-- RLS check via auth.uid() against bills.organizer_id
-- Sets payment_status='confirmed', confirmed_at=now(), clears rejected_reason

CREATE OR REPLACE FUNCTION public.reject_payment(
  p_participant_id UUID,
  p_reason         TEXT
) RETURNS json LANGUAGE plpgsql;
-- Sets payment_status='rejected', rejected_reason=p_reason
-- Participant can re-submit, which moves back to 'pending'

CREATE OR REPLACE FUNCTION public.post_organizer_message(
  p_participant_id UUID,
  p_body           TEXT
) RETURNS json LANGUAGE plpgsql;
-- RLS-gated, inserts message with sender='organizer'

CREATE OR REPLACE FUNCTION public.mark_participant_messages_read(p_participant_id UUID)
  RETURNS json LANGUAGE plpgsql;
-- RLS-gated; sets read_at = now() on all participant_messages where
--   participant_id = p_participant_id AND sender='participant' AND read_at IS NULL
-- Called when organizer opens the approval sheet for a participant
```

### 5.1 Notification trigger updates

Extend the existing `notify_participant_paid` trigger so it fires on more transitions:

```sql
CREATE OR REPLACE FUNCTION public.notify_payment_event()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_event TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    v_event := CASE NEW.payment_status
                 WHEN 'pending'   THEN 'payment_submitted'
                 WHEN 'confirmed' THEN 'payment_confirmed'
                 WHEN 'rejected'  THEN 'payment_rejected'
                 ELSE NULL
               END;

    IF v_event IS NOT NULL THEN
      PERFORM net.http_post(
        url     := 'https://bccarnwtdqamedtlzdht.supabase.co/functions/v1/notify-organizer',
        headers := jsonb_build_object(
          'Content-Type',      'application/json',
          'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_secret')
        ),
        body    := jsonb_build_object(
          'event',          v_event,
          'participant_id', NEW.id,
          'bill_id',        NEW.bill_id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS participants_payment_notify ON public.participants;
CREATE TRIGGER participants_payment_notify
  AFTER UPDATE ON public.participants
  FOR EACH ROW EXECUTE FUNCTION public.notify_payment_event();

-- New trigger for messages
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.sender = 'participant' THEN
    PERFORM net.http_post(
      url     := 'https://bccarnwtdqamedtlzdht.supabase.co/functions/v1/notify-organizer',
      headers := jsonb_build_object(
        'Content-Type',      'application/json',
        'x-internal-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'internal_secret')
      ),
      body    := jsonb_build_object(
        'event',          'message_from_participant',
        'participant_id', NEW.participant_id,
        'message_id',     NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER pmessages_notify
  AFTER INSERT ON public.participant_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();
```

### 5.2 `notify-organizer` edge function

Extend the existing function to switch on `event` and produce different push payloads:

- `payment_submitted` → title "{participant} submitted payment", body "Tap to review", data `{ billId, action: 'review' }`
- `payment_confirmed` → no push (organizer initiated it); skip
- `payment_rejected` → no push to organizer; skip (participant page already reflects state via Realtime)
- `message_from_participant` → title "{participant}", body "{message body, truncated}"

### 5.3 New edge function `create-proof-upload-url`

```ts
// POST { token: string, filename: string, contentType: string }
// → { uploadUrl: string, publicPath: string }
```

Validates token via service-role client, returns a short-lived (60s) signed upload URL into `payment-proofs/{participant_id}/{uuid}.{ext}`. Limits: 5 MB max, MIME must be `image/jpeg|png|webp`.

### 5.4 New edge function `scan-payment-proof`

```ts
// POST { token: string, proofPath: string }
// → { extracted: ProofExtraction, summary: string }
```

Validates token, fetches the just-uploaded proof from storage, and calls the existing **`gemini-scan-receipt`** function (already in `supabase/functions/`) — it already extracts amount, currency, date, line items. We prompt-tune it minimally to also pull a bank/reference field. Then:

1. Compute `matchesExpected = Math.abs(extracted.amount - expected.amount) <= 0.10`
2. Build a one-line `summary` — e.g. "Receipt from {bank}, {currency}{amount}, ref {reference} — matches expected ✓" or "Couldn't read amount confidently"
3. Persist to `participants.proof_extracted` (JSONB) and `participants.proof_summary` (text)
4. Return both to the client so the participant page can show the inline feedback ("Looks right ✓") immediately

This call is fire-and-forget from the client; if it fails or times out, the swipe-to-confirm flow still works (the organizer just won't get the AI banner).

### 5.5 Rate limiting

Lightweight in-DB rate limit table — keep complexity minimal:

```sql
CREATE TABLE IF NOT EXISTS public.rate_limit_log (
  bucket      TEXT NOT NULL,
  key         TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rate_limit_log ON public.rate_limit_log(bucket, key, occurred_at DESC);
```

RPCs check + insert under a per-token bucket. Limits:
- `submit_payment`: 5/min per token
- `post_participant_message`: 10/min per token
- `create-proof-upload-url`: 5/min per token
- `scan-payment-proof`: 5/min per token

A daily cleanup job (cron or function) deletes rows older than 1 day.

## 6. Routes

| Path | File | Auth | Purpose |
|------|------|------|---------|
| `/p/[token]` | `app/p/[token].tsx` | Public (token) | Participant payment page (web + mobile) |
| `/(modals)/bill/[id]/invoice` | existing | Organizer | Invoice screen — gains approve/reject UI |
| `/(modals)/share/[code]` | existing | Public (code) | **Deprecated**, kept until cleanup |

The organizer's "Share" affordance in the invoice screen changes from sharing the bill-level `invite_token` to sharing individual `participants.access_token`s. The bill-level URL is no longer surfaced in the UI for new bills.

## 7. UI Specification

### 7.1 Participant page `app/p/[token].tsx`

Single scrollable column on a neutral background (`#F8F9FB`, matching invoice screen). All sections animated in with `FadeInUp` / `FadeIn` for parity with the rest of the app.

1. **Brand header** — GoCheck logo + `invoice_number`. Matches `brandRow` style from `invoice.tsx`.
2. **Status card** — full-width `GlowingCard`, color and content driven by `paymentStatus`:
   - `unpaid` → blue accent, "Amount due" label, `CountUp` of amount, due-date countdown
   - `pending` → amber accent, spinner + "Waiting for {organizer} to confirm" + AI summary preview if Gemini extracted anything
   - `confirmed` → green accent, large check icon + "Paid ✓ on {confirmedAt}" + **confetti burst** (`react-native-confetti-cannon`) on first paint after transition, then shareable receipt card below
   - `rejected` → red accent, "Payment couldn't be confirmed", organizer's reason, "Try again" CTA scrolls to the swipe bar
3. **Greeting** — "Hi {participant.name}, {organizer.displayName} sent you a bill"
4. **Amount block** — `CountUp` formatted as `{currencySymbol}{amount}`, bill title under it, due date as small grey text. **Early-payer badge** ("🌟 Early payer — {n} days before due") shown if confirmed before `dueDate`.
5. **Anonymized social proof** — small chip "{paidCount} of {totalCount} have paid" + horizontal bar (no names, just counts) — gentle pressure without privacy leak
6. **Payment instructions card** — payment method label + details. If method is `duitnow`, render a **locally-generated QR** (see §7.4) from organizer's DuitNow ID/amount. Long-press any field to copy with haptic feedback
7. **Proof upload (collapsible)** — `<input type="file">` on web, `expo-image-picker` on mobile. Thumbnail preview after upload, ✕ to remove. Subtext "Optional — we'll auto-detect the amount to speed things up". After upload, calls Gemini proof-scan; if extracted amount matches expected within RM 0.10, show green check "Looks right ✓"; if mismatched, show amber "We read {extracted} — double-check?"
8. **Slide-to-confirm bar** — visible only when `paymentStatus` ∈ `{ 'unpaid', 'rejected' }`. Implemented with `react-native-reanimated` PanGestureHandler. On commit: optional proof upload → `submit_payment` RPC → status flips to `pending` instantly (optimistic) → Realtime confirms
9. **Message thread** — scroll of messages (organizer left, participant right), composer at bottom. Above composer: **quick-reply chips** sized to context (`unpaid`: "I'll pay tonight 🙏", "What's the QR?", "Need more time"; `pending`: "Did you get it?", "Thanks!"; `rejected`: "Sorry, retrying 🙏"). Tap a chip → instantly sends. Realtime appends incoming messages
10. **Receipt card** (only when `confirmed`) — saved as a generated image via `react-native-view-shot`, share button beneath ("Save receipt" / "Share to WhatsApp"). Card shows GoCheck brand, invoice number, amount, both names, confirmed timestamp, tiny QR linking back to this page for verification
11. **Footer** — "Secure record by GoCheck" + privacy line

**Components reused:** `GlowingCard`, `SheenButton`, `CountUp`, `FadeInUp`, `colors`, `typography`, `spacing`, `radius`, `shadow`.

**New components:**
- `src/components/payment/StatusCard.tsx` — status-driven card with state-dependent visuals
- `src/components/payment/SlideToConfirm.tsx` — pan-gesture swipe bar with sheen and haptic snap
- `src/components/payment/MessageThread.tsx` — thread + composer + quick-reply chips
- `src/components/payment/QuickReplyChips.tsx` — preset reply bar (state-aware)
- `src/components/payment/ProofUpload.tsx` — proof picker (platform-branched) + auto-scan integration
- `src/components/payment/DuitNowQR.tsx` — local QR generator (uses `react-native-qrcode-svg`)
- `src/components/payment/SocialProofChip.tsx` — anonymized paid-count chip + bar
- `src/components/payment/EarlyPayerBadge.tsx` — celebratory badge
- `src/components/payment/ReceiptCard.tsx` — savable/shareable receipt image

### 7.2 Organizer additions in `app/(modals)/bill/[id]/invoice.tsx`

In the existing participants table:

- **Status pill** updated to four states: `Unpaid | Pending review | Paid | Rejected` (color coded)
- **Per-row action button** in the rightmost cell, replacing the static status:
  - `unpaid` → ➤ "Send link" (opens native Share with `https://gocheck.app/p/{accessToken}`, pre-filled message including bill title + amount)
  - `pending` → orange "Review" button (taps → opens approval sheet)
  - `confirmed` → checkmark (no action)
  - `rejected` → "Re-send link"
- **Unread message dot** on participants with unread messages (`COUNT(*) FROM participant_messages WHERE read_at IS NULL AND sender='participant'`)

**Approval bottom sheet** (new component `src/components/bill/PaymentReviewSheet.tsx`):
- Participant name + amount header
- **Gemini AI summary banner** at top — one-line synthesis: e.g. "Receipt from Maybank, RM 25.00, ref TXN-12345 — matches expected amount ✓" (green) or "Couldn't read amount confidently" (amber). Generated by `gemini-scan-receipt` edge function (already exists) called when proof is uploaded; result cached on `participants.proof_summary`
- Proof image at full width, tap to zoom (signed URL fetched on open)
- Their note (if any)
- Message thread preview + reply composer with **organizer-side quick-reply chips** ("Thanks, confirmed!", "Could you re-send?", "Got it, will check")
- Two big buttons: **Approve** (green, calls `confirm_payment`) / **Reject** (red, opens reason input then calls `reject_payment`)
- If AI summary confirms a match, Approve button gains a subtle pulse animation as a nudge

**Coin-drop animation** in the participant table — when a participant transitions to `pending` via Realtime, their row briefly highlights amber and a small "💰" icon drops into the progress bar (uses `react-native-reanimated` shared values). Pure local animation, no API.

### 7.3 Share-link UX in invoice screen

Replace the existing single "Share Invoice" / "Copy Link" actions:
- Header "Share" button → opens a participants list bottom sheet → tap participant → native Share sheet with their unique link
- Bulk action "Send all links" → iterates Share sheets per participant (one at a time)
- Each row in the share sheet also offers **WhatsApp deep-link** (`whatsapp://send?text=...&phone={participant.phone}`) when participant has a phone number, alongside the generic Share. No WhatsApp API — just the URL scheme the OS handles.

### 7.4 Local DuitNow QR generation (`DuitNowQR.tsx`)

We don't call any QR API. The component uses `react-native-qrcode-svg` to render an SVG QR locally on web and mobile. The encoded payload is the organizer's DuitNow ID (phone, NRIC, or business reg) plus the expected amount in EMVCo TLV format (Malaysian QR standard). For MVP, we encode a simple `duitnow://pay?id={id}&amount={amount}&ref={invoiceNumber}` URI as a fallback — banking apps that don't recognize it still let the user scan and enter manually. The render is a pure function of `paymentDetails`, no async work.

### 7.5 Receipt card generation (`ReceiptCard.tsx`)

When `paymentStatus = 'confirmed'`, render an offscreen view styled like a receipt:
- GoCheck brand strip
- Invoice number, both names, amount, confirmed timestamp
- Tiny QR linking back to `/p/{token}` for organizer verification

Use `react-native-view-shot` (web: `html2canvas` fallback) to snapshot the view to a PNG data URL. The "Share receipt" button uses the same `Share.share({ url })` API the invoice screen already uses. Pure client-side, no server round trip.

## 8. State Machine

```
                    ┌─────────────────────────────┐
                    │           UNPAID            │ ◄──── initial state
                    └──────────────┬──────────────┘
                                   │ participant swipes
                                   ▼
                    ┌─────────────────────────────┐
                ┌── │           PENDING           │
                │   └──────────────┬──────────────┘
                │                  │
   organizer    │                  │  organizer
   rejects      │                  ▼  approves
                │   ┌─────────────────────────────┐
                │   │          CONFIRMED          │ ◄── terminal
                │   └─────────────────────────────┘
                ▼
   ┌─────────────────────────────┐
   │          REJECTED           │
   └──────────────┬──────────────┘
                  │ participant re-submits
                  └────────► back to PENDING
```

Allowed transitions are enforced inside `submit_payment`, `confirm_payment`, `reject_payment`. Any other transition raises an exception.

## 9. Realtime

Participant page subscribes to:
- `postgres_changes` on `participants` row where `id = {participantId}` — for status changes
- `postgres_changes` on `participant_messages` where `participant_id = {participantId}` — for new messages

Organizer's invoice screen subscribes to:
- `postgres_changes` on all `participants` rows for the current bill — for participants updating status
- `postgres_changes` on `participant_messages` rows joined to bill — for incoming messages

On reconnect, both clients re-fetch the latest state in addition to subscribing.

## 10. Error Handling

| Scenario | Behavior |
|----------|----------|
| Token not found | "This link is no longer valid" screen, no technical error exposed |
| Bill cancelled | "This bill was cancelled by the organizer", inputs hidden |
| Re-submit on confirmed | `submit_payment` returns `{ already_confirmed: true }`; UI locks |
| Oversized proof file | Inline "Image too large, max 5 MB" before upload |
| Wrong file type | Inline "JPG, PNG, or WebP only" |
| Upload network failure | Retry button; submission can proceed without proof |
| Rate-limited RPC | Toast "Too many requests, try again in a moment" |
| Realtime disconnect | Auto-resubscribe; re-fetch on app visibility change |
| Concurrent approve+reject | Last write wins; UI shows the resulting state |

XSS-safe by default: message bodies are stored as plain text and rendered with React Native `<Text>` (no HTML, no markdown).

## 11. Privacy

- `get_participant_view` returns the participant's own amount, status, proof, and messages — **never** other participants' data
- Organizer display name comes from `user_profiles.display_name`; organizer email and phone are not surfaced unless the organizer has explicitly enabled a "show my contact on invoices" toggle (out of scope — assume not surfaced)
- Proof images are stored in a **private** bucket; organizer fetches via short-lived signed URLs server-side; participants only see their own uploaded proof (returned in `get_participant_view`)
- Access token in the URL is the only credential — generated by `gen_random_uuid()` (122 bits of entropy, not enumerable)

## 12. Testing

**SQL / RPC tests** (`supabase/tests/participant_payment_flow.sql`, pgTAP):
- `get_participant_view`: valid token, invalid token, cancelled bill returns null, only own data
- `submit_payment`: happy path, idempotency, already_confirmed branch, re-submit after reject
- `confirm_payment` / `reject_payment`: RLS denies non-organizer
- State machine: every disallowed transition raises
- Rate limit: 6th call within 60s raises

**Component tests** (`src/components/payment/__tests__/`):
- `StatusCard` renders each of the four states correctly, confetti only on `confirmed`
- `SlideToConfirm` fires callback on full swipe, snaps back on incomplete
- `MessageThread` renders, posts, appends realtime
- `ProofUpload` validates size + MIME, dispatches scan, renders match/mismatch feedback
- `QuickReplyChips` shows the right chip set per status
- `DuitNowQR` renders SVG for valid input, gracefully degrades for missing fields
- `SocialProofChip` displays "n of m" without leaking names
- `EarlyPayerBadge` only shows when `confirmedAt < dueDate`
- `ReceiptCard` snapshot match (`react-native-view-shot` mock)

**E2E manual checklist** (documented in implementation plan):
- Bill with 3 participants → share each link in 3 incognito browser tabs
- Each tab shows only its own amount; no other participants visible
- One tab submits with proof → organizer push fires → invoice screen shows Review badge
- Organizer approves → that tab updates via Realtime to Paid state
- Another tab submits without proof → organizer rejects with reason → tab shows reason + can re-submit
- Messages sent both directions arrive in real time on both sides
- Cancelled bill → all open participant pages show "Cancelled" state

## 13. Rollout

1. Migration `008` runs (backfills tokens + statuses, adds messages table)
2. Edge functions deployed (`notify-organizer` updated, `create-proof-upload-url` new)
3. App update ships with:
   - New `app/p/[token].tsx` route
   - Invoice screen updates (approve/reject sheet, per-participant share)
   - New payment components
4. Old `share/[code]` page kept active for any links already in the wild
5. Cleanup PR (separate, later) removes the old shared-link UI from the organizer side and the `share_links` table

## 14. Open Risks

- **Storage cost** — proof images could accumulate; add a retention policy (e.g., delete proofs > 12 months after `confirmed_at`) in a follow-up
- **Universal links on web→app handoff** — if a participant has the app installed and taps the link on mobile, we should respect `apple-app-site-association` / `assetlinks.json` so the app handles it. Configuration is needed; same `app/p/[token].tsx` route handles both
- **Realtime quota** — Supabase Realtime has per-connection limits on free tier; we subscribe per active page so a bill with many open participant tabs could hit limits during reminder bursts. Monitor and consider channel sharing later

---

**End of spec.**
