# Reminders / Nudge Feature Design

**Date:** 2026-05-24  
**Status:** Approved for implementation  

---

## Goal

Let a bill organizer send WhatsApp / Email nudges to unpaid participants directly from GoCheck, with a log of what was sent, and settings for tone, cadence (queue visibility), and frequency cap.

---

## Entry Point

The **Bills tab** header gains a bell icon button (right side, next to the existing `+` button). The bell shows a badge equal to `queue.length` — the number of participants currently visible in the Queue pane, **not** the raw unpaid count. Badge hidden when 0.

Tapping the bell pushes `app/(modals)/reminders.tsx` as a full-screen card modal (slide from right). This keeps the Activity tab untouched.

**No new bottom-nav tab is added.**

---

## Screen Structure

```
app/(modals)/reminders.tsx
└── AppHeader "Reminders" + back button
└── SegmentedControl [ Queue · Sent · Settings ]
    ├── <QueuePane />
    ├── <SentPane />
    └── <SettingsPane />
```

Default tab on open: `queue`.

---

## Pane 1 — Queue

### Data source

Pull every unpaid participant across all active bills from the Zustand bill store. Apply the following filters **in order**:

1. `skipPaid: true` → exclude `participant.isPaid === true` (always enforced)
2. Exclude any participant whose `participantId === organizerId` (don't nudge yourself)
3. Apply **cadence visibility filter** (see Settings → cadence)
4. Apply **maxPerWeek filter**: if the participant has `>= maxPerWeek` reminders in the past 7 days (from Supabase `reminders` table, matching `bill_id + participant_id`), hide the row and instead show a **"Limit reached"** banner row with their name grayed out

**Sort order** (after filters): `daysToDue ASC` — soonest-due first. Overdue participants have negative `daysToDue`, so they sort to the top.

### Batch card (indigo gradient, top of list)

Shown only when `queue.length > 0`.

```
Title:   "Send all {queue.length} reminders"
Sub:     "{tone} tone · via WhatsApp"
Button:  [Send all]
```

**"Send all" is sequential one-at-a-time:**
- Opens recipient 1's WhatsApp link
- Logs row to `reminders` table immediately (optimistic)
- On app return: shows a toast banner → **"1 of {N} sent — tap to continue"** with a [Send next] button
- Each tap advances to the next recipient
- When all done: toast "All {N} reminders sent 🎉"
- State: `store.batchQueue` array, pointer advances per confirmation

Hidden when `queue.length === 0`.

### Queue row (one per filtered participant)

Layout (fixed height — no layout shift when reliability chip absent):

```
[Avatar]  [Name]  [reliability chip OR fixed-width empty slot]  ["asked N×" chip if count > 0]
          [Bill title · Amount]  [Due in N days / N days overdue (red)]
          [WhatsApp btn]  [Email btn if participant.email exists]
```

**Avatar:** initials fallback (colored by avatarColor). If `participant.phone` exists, wa.me uses it directly.

**Reliability chip** (calculated from reminders + payment history):
- Paid before due date on past bills → **Reliable** (green)
- Paid on due date → **On-time** (blue)
- Paid 1–7 days late → **Slow** (amber)
- Paid 7+ days overdue or never → **At-risk** (red)
- No history → slot is empty (fixed width preserved, no chip rendered)

**"asked N×" chip:** shows when `remindersForParticipant.length > 0`. Count = **lifetime** per `(billId, participantId)` — never resets.

**Channel buttons:**
- **WhatsApp**: always shown. Link = `wa.me/{phone}?text=<encoded>` if `participant.phone` exists, else `wa.me/?text=<encoded>` (contact picker).
- **Email**: shown **only** if `participant.email` exists. Link = `mailto:{email}?subject=...&body=<encoded>`.
- **SMS**: hidden entirely (no phone number contract).
- When only one channel available, render only that one — no disabled placeholders.

**On channel button tap:**
1. Construct message from `renderTemplate(tone, { name, bill, amount, when, days, link })`
2. Open deep link (Linking.openURL)
3. Insert row into Supabase `reminders` table immediately (optimistic)
4. Append to `state.reminders.sent` in Zustand

### Empty state

Icon: `check-circle-2`, title: **"All caught up"**, sub: **"Nobody to nudge right now."**

---

## Pane 2 — Sent

### Data source

`state.reminders.sent` — loaded from Supabase `reminders` where `organizer_id = getOrganizerId()`, ordered `sent_at DESC`.

### Row layout

```
[Channel icon circle]  [Recipient name]
                       via {channel} · {relativeTime(sentAt)}   e.g. "3 hours ago"
```

Channel icon colors: WhatsApp = green (#25D366), Email = blue (#4F46E5).

### Info note (top of pane, always visible)

Small `ⓘ` row: *"Reminders are logged when sent — confirm delivery in your WhatsApp or email outbox."*

### Empty state

Icon: `send`, title: **"No reminders sent yet"**, sub: **"Send your first reminder from the Queue tab."**

---

## Pane 3 — Settings

Four white cards. Each setting writes through `store.setSetting('reminders.<key>', value)` which patches the Supabase `user_settings.reminders` jsonb blob **and** updates local Zustand state simultaneously.

---

### Card 1 — Cadence (queue-visibility logic, NOT auto-send)

SegmentedControl: **Manual · Smart · Aggressive**

Helper text changes per selection:

| Option | Helper text |
|--------|-------------|
| Manual | "All unpaid participants appear in the queue at all times." |
| Smart | "Shows participants 3 days before due, on due date, and every 3 days after. Others are reachable from the bill detail." |
| Aggressive | "All unpaid participants shown every day, overdue first. Use sparingly." |

**Queue filter logic per cadence:**
- **Manual**: no time filter — all unpaid pass through
- **Smart**: participant appears if `daysToDue <= 3` OR `daysToDue <= 0` (overdue) OR `daysSinceLastReminder >= 3`
- **Aggressive**: all unpaid always appear (same as Manual but sorted overdue-first)

No auto-send ever occurs. The cron/scheduler is a future feature.

---

### Card 2 — Message Tone

Three pill buttons: **Friendly · Firm · Final**  
Active = indigo background + white text. Inactive = slate-100 + slate-700.

Live preview block below pills (italic, slate-700):

```
friendly: "Hey {name}! Just a heads up — your share of "{bill}" ({amount}) is due {when}. Easy to settle from the link below. Cheers! 🙌"
firm:     "Hi {name}, your share of "{bill}" ({amount}) is due {when}. Please settle at your earliest convenience: {link}"
final:    "{name} — final reminder. {amount} for "{bill}" is overdue by {days} days. Please pay today: {link}"
```

Preview updates **within the same render frame** (no async). Preview shows literal `{tokens}` in italics (not filled — it's a template preview).

---

### Card 3 — Skip + Frequency Cap

**Toggle:** "Skip already-paid people" (default ON). Writes `reminders.skipPaid`.

**Slider:** "Max reminders per person per week" — range 1–7, integer steps, default 2. Label: `"Max {value} per week"`. Writes `reminders.maxPerWeek`.

---

### ~~Card 4 — Send window~~ (removed for v1)

`sendWindow` setting is **not implemented in v1**. No UI, no stored key. Removing avoids misleading users about scheduled sending that doesn't exist.

---

## Template Token Contract

All tokens used in `reminderTemplates.ts`:

| Token | Value |
|-------|-------|
| `{name}` | `participant.name` |
| `{bill}` | `bill.title` |
| `{amount}` | Formatted currency string e.g. `RM 45.00` |
| `{when}` | `"today"` / `"in 3 days"` / `"5 days ago"` (computed from `bill.dueDate`) |
| `{days}` | Integer days overdue (used in `final` tone only) |
| `{link}` | `https://gocheck.app/bill/{bill.shareLink}` |

No other tokens. Claude Code must not invent additional tokens.

---

## Supabase Schema Changes

### New table: `reminders`

```sql
create table reminders (
  id uuid primary key default gen_random_uuid(),
  organizer_id text not null,
  bill_id uuid references bills(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  recipient_name text not null,
  channel text not null check (channel in ('whatsapp','email','sms')),
  sent_at timestamptz default now(),
  created_at timestamptz default now()
);

create index on reminders(organizer_id, sent_at desc);
create index on reminders(bill_id, participant_id);
```

No RLS for MVP (organizer_id is per-device; fine for MVP, flag for auth migration later).

### New table: `user_settings`

```sql
create table user_settings (
  organizer_id text primary key,
  reminders jsonb not null default '{
    "cadence": "smart",
    "tone": "friendly",
    "skipPaid": true,
    "maxPerWeek": 2
  }'::jsonb,
  updated_at timestamptz default now()
);
```

### Modify table: `participants` (add contact columns)

```sql
alter table participants
  add column if not exists phone text,
  add column if not exists email text;
```

> Note: `participants` already has an `email` column from the original schema. Only `phone` is new. Confirm before running.

---

## Zustand Store Additions (`src/store/reminderStore.ts`)

```ts
interface ReminderState {
  sent: ReminderRow[];
  settings: ReminderSettings;
  batchQueue: QueueItem[];   // for sequential Send all
  batchPointer: number;       // index of next to send
  isLoading: boolean;

  loadReminders: (organizerId: string) => Promise<void>;
  loadSettings: (organizerId: string) => Promise<void>;
  sendReminder: (billId: string, participantId: string, channel: string) => Promise<void>;
  setSetting: (path: string, value: unknown) => Promise<void>;
  startBatch: (queue: QueueItem[]) => void;
  advanceBatch: () => void;
}

interface ReminderSettings {
  cadence: 'manual' | 'smart' | 'aggressive';
  tone: 'friendly' | 'firm' | 'final';
  skipPaid: boolean;
  maxPerWeek: number;
}

interface ReminderRow {
  id: string;
  billId: string;
  participantId: string;
  recipientName: string;
  channel: string;
  sentAt: string;
}

interface QueueItem {
  billId: string;
  billTitle: string;
  participantId: string;
  participantName: string;
  participantPhone?: string;
  participantEmail?: string;
  amount: number;
  currency: string;
  dueDate: string;
  shareLink: string;
}
```

---

## New Files

| Path | Purpose |
|------|---------|
| `app/(modals)/reminders.tsx` | Screen shell — header + SegmentedControl |
| `src/components/reminders/QueuePane.tsx` | Batch card + filtered list |
| `src/components/reminders/QueueRow.tsx` | Per-participant row (fixed layout) |
| `src/components/reminders/SentPane.tsx` | Sent list + ⓘ note |
| `src/components/reminders/SentRow.tsx` | Per-sent row |
| `src/components/reminders/SettingsPane.tsx` | Three settings cards |
| `src/components/reminders/BatchToast.tsx` | Sequential send banner |
| `src/lib/reminderTemplates.ts` | `renderTemplate(tone, tokens)` + previews |
| `src/store/reminderStore.ts` | Zustand store |
| `src/lib/supabase.ts` | Add `insertReminder`, `loadReminders`, `loadSettings`, `upsertSettings` |

## Modified Files

| Path | Change |
|------|--------|
| `app/(tabs)/bills.tsx` | Add bell icon + badge in header, register modal route |
| `app/_layout.tsx` | Register `(modals)/reminders` Stack.Screen |
| `app/(tabs)/_layout.tsx` | No change — Activity tab untouched |
| `src/types/index.ts` | Add `ReminderRow`, `ReminderSettings`, `QueueItem` types |

---

## Acceptance Criteria

1. Bell badge = `queue.length` (filtered, not raw unpaid count)
2. Queue ordered `daysToDue ASC` (overdue = negative → top)
3. "Send all" opens recipient 1 → toast on return → [Send next] → repeats until done
4. "asked N×" chip = lifetime per `(billId, participantId)`, appears only when count > 0
5. Reliability chip slot has fixed width — rows don't shift when chip absent
6. Tone change updates preview text in same render frame
7. WhatsApp always shown. Email shown only if `participant.email` exists. SMS hidden.
8. All three settings (cadence, tone, skipPaid, maxPerWeek) round-trip through `user_settings.reminders` jsonb and survive reload
9. Sent tab shows ⓘ note at top
10. Empty queue → check-circle empty state, no batch card rendered
11. Empty sent → send-icon empty state
12. Activity tab unchanged
13. `npx tsc --noEmit` passes

---

## Out of Scope (v1)

- Send window / quiet hours / scheduled dispatch (no cron)
- SMS channel (no phone contract in existing bills)
- Push notifications
- Delivery receipts / read status
- Custom template editor
- Confirm-send dialog (optimistic log accepted)
- RLS / user authentication
