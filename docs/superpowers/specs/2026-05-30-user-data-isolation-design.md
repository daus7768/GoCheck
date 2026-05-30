# User Data Isolation — RLS, FK Enforcement & Payment Notifications

**Date:** 2026-05-30
**Status:** Approved (revised after code review)

## Goal

Ensure every authenticated user sees and manages only their own data. When a participant marks themselves as paid (via share link), the organizer receives a push notification.

## Architecture

Four layers of work, in dependency order:

1. **Auth wiring** — replace local `getOrganizerId()` with real `session.user.id`
2. **Database** — enforce FK integrity and Row Level Security (RLS) with safe public RPCs
3. **Notification pipeline** — Postgres trigger → Supabase Edge Function → Expo Push API
4. **App** — install `expo-notifications`, register push token on login

---

## Section 0 — Pre-requisite: Replace `getOrganizerId()`

`src/lib/organizer.ts` currently generates a random UUID stored in `AsyncStorage`. This is used in **9 files** across the app. None of these UUIDs match `auth.users.id`, so the FK migration would break bill creation immediately.

**Before migration 006 can land**, every call to `getOrganizerId()` must be replaced with `useProfileStore.getState().session?.user.id`.

Files to update:
- `app/(modals)/create.tsx`
- `app/(modals)/bill/[id].tsx`
- `app/(modals)/reminders.tsx`
- `app/(tabs)/bills.tsx`
- `app/(tabs)/index.tsx`
- `src/hooks/useReportsData.ts`
- `src/store/reminderStore.ts`

After replacement, `src/lib/organizer.ts` can be deleted.

Existing rows in `bills`, `reminders`, `user_settings` that have non-auth UUIDs will not match any `auth.users.id`. These rows should be deleted or migrated before the FK is enforced. For a fresh/dev database, truncating is fine.

---

## Section 1 — Database: FK + RLS (Migration 006)

### FK Changes

Alter `organizer_id` from `VARCHAR(255)` to `UUID REFERENCES auth.users(id) ON DELETE CASCADE` on:

- `bills`
- `reminders`
- `user_settings`

Only safe to run after Section 0 is complete and existing orphaned rows are cleared.

### RLS Policies

Enable RLS on every table below with explicit `USING` and `WITH CHECK` clauses.

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `bills` | `organizer_id = auth.uid()` | `WITH CHECK (organizer_id = auth.uid())` |
| `participants` | Organizer via bill join; public via active share link (see RPC) | Organizer via bill join |
| `line_items` | Same as participants | Organizer via bill join |
| `share_links` | Public: `is_active = true AND (expires_at IS NULL OR expires_at > now())` | Organizer via bill FK check |
| `payments` | Organizer via bill join | Organizer via bill join |
| `reminders` | `organizer_id = auth.uid()` | `WITH CHECK (organizer_id = auth.uid())` |
| `user_settings` | `organizer_id = auth.uid()` | `WITH CHECK (organizer_id = auth.uid())` |

`user_profiles` already has RLS (migration 005).

Share-links organizer write policy uses a subquery:
```sql
EXISTS (
  SELECT 1 FROM bills
  WHERE bills.id = share_links.bill_id
  AND bills.organizer_id = auth.uid()
)
```

### Public RPCs (SECURITY DEFINER)

Direct queries from unauthenticated share-link users will fail under RLS. Two RPCs replace the direct queries:

**`get_bill_by_share_link(code TEXT)`**
- Verifies the share link is active and not expired
- Returns bill + participants + line_items for that bill only
- Replaces `getBillByShareLink()` in `src/lib/supabase.ts`

**`mark_participant_paid(share_code TEXT, participant_id UUID)`**
- Verifies share link is active and participant belongs to that bill
- Sets `is_paid = true`, `paid_at = now()`
- Replaces direct `markParticipantPaid()` call from unauthenticated contexts
- Replaces `src/lib/supabase.ts` `markParticipantPaid()` when called from share link view

Both functions run as `SECURITY DEFINER` with `SET search_path = public`.

---

## Section 2 — Payment Notification Pipeline

### Flow

1. Organizer creates a bill → participants receive share link via WhatsApp/email
2. Participant opens link (no login required), calls `mark_participant_paid()` RPC
3. RPC sets `is_paid = true`
4. Postgres `AFTER UPDATE` trigger fires on `participants` when `OLD.is_paid = false AND NEW.is_paid = true`
5. Trigger uses `pg_net` to POST to Supabase Edge Function `notify-organizer` with a shared secret header
6. Edge Function verifies the secret header, then:
   - Fetches bill title and organizer's `expo_push_token` from `user_profiles`
   - If token is null, exits silently
   - POSTs to Expo Push API: *"[Name] just paid RM [amount] for [Bill title]"*

### Schema Addition

```sql
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS expo_push_token TEXT;
```

### Edge Function: `notify-organizer`

- Verifies `x-internal-secret` header matches env var `INTERNAL_SECRET`
- Input payload: `{ "participant_id": "uuid", "bill_id": "uuid" }`
- Joins `participants → bills → user_profiles`
- POSTs to `https://exp.host/--/api/v2/push/send`
- Idempotent: duplicate calls for the same participant just re-send (acceptable; trigger guards against it)

---

## Section 3 — App Changes

### Install expo-notifications

```
npx expo install expo-notifications
```

### Push Token Registration

In `profileStore.loadProfile()`, after profile is loaded/created:

```ts
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const { status } = await Notifications.requestPermissionsAsync();
if (status === 'granted') {
  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  });
  if (token !== profile.expoPushToken) {
    await upsertProfile({ id: userId, expoPushToken: token });
  }
}
```

Add `expoPushToken?: string` to `UserProfile` type in `src/types/index.ts`.

Update `rowToProfile()` in `src/lib/supabase.ts` to map `expo_push_token → expoPushToken`.

Update `upsertProfile()` to include `expo_push_token` in the row mapping.

### supabase.ts: Replace direct queries with RPCs

- `getBillByShareLink(code)` → call `get_bill_by_share_link` RPC
- `markParticipantPaid()` when called from share link context → call `mark_participant_paid` RPC

### Organizer ID

All 7 files using `getOrganizerId()` replaced with `useProfileStore.getState().session?.user.id`. Guards added where session may be null.

---

## Data Flow Summary

```
User logs in
  → profileStore requests notification permission
  → saves Expo push token to user_profiles

User creates bill
  → bill.organizer_id = session.user.id (enforced by RLS WITH CHECK)

Participant opens share link (no auth)
  → calls get_bill_by_share_link() RPC (SECURITY DEFINER bypasses RLS)
  → calls mark_participant_paid() RPC (SECURITY DEFINER, validates share link)
  → DB trigger fires (OLD.is_paid=false → NEW.is_paid=true only)
  → Edge Function (secret-verified) → Expo Push → organizer notified
```

---

## Implementation Order

1. Replace `getOrganizerId()` across all 7 files → delete `organizer.ts`
2. Migration 006: FK changes + RLS + RPCs + `expo_push_token` column
3. Edge Function `notify-organizer` + DB trigger
4. App: install `expo-notifications`, token registration in `profileStore`
5. Update `supabase.ts` RPC calls

---

## Out of Scope

- In-app notification inbox
- Email/WhatsApp notification on payment (covered by existing reminders feature)
- Multi-organizer bills
- Backfilling existing production data (dev database truncate is sufficient)
