# User Data Isolation — RLS, FK Enforcement & Payment Notifications

**Date:** 2026-05-30
**Status:** Approved

## Goal

Ensure every authenticated user sees and manages only their own data. When a participant marks themselves as paid (via share link), the organizer receives a push notification.

## Architecture

Three layers of work:

1. **Database** — enforce FK integrity and Row Level Security (RLS) on all tables
2. **Notification pipeline** — Postgres trigger → Supabase Edge Function → Expo Push API
3. **App** — register Expo push token on login and save to `user_profiles`

---

## Section 1 — Database: FK + RLS (Migration 006)

### FK Changes

Alter `organizer_id` from `VARCHAR(255)` to `UUID REFERENCES auth.users(id) ON DELETE CASCADE` on:

- `bills`
- `reminders`
- `user_settings`

Safe to run because the app already stores the Supabase auth UUID as `organizer_id`.

### RLS Policies

Enable RLS on every table below and apply the stated policies.

| Table | Policy |
|---|---|
| `bills` | Organizer CRUD: `organizer_id = auth.uid()` |
| `participants` | Organizer CRUD via bill join; public SELECT (for share link viewers) |
| `line_items` | Organizer CRUD via bill join; public SELECT |
| `share_links` | Public SELECT on active links; organizer INSERT/UPDATE/DELETE |
| `reminders` | Organizer CRUD: `organizer_id = auth.uid()` |
| `user_settings` | Organizer CRUD: `organizer_id = auth.uid()` |

`user_profiles` already has RLS enabled (migration 005).

---

## Section 2 — Payment Notification Pipeline

### Flow

1. Organizer creates a bill → participants receive share link via WhatsApp/email
2. Participant opens link (no login required), sees their amount, taps Pay
3. App calls `markParticipantPaid()` which updates `participants.is_paid = true`
4. Postgres `AFTER UPDATE` trigger fires on the `participants` table when `is_paid` changes `false → true`
5. Trigger uses `pg_net` to POST to Supabase Edge Function `notify-organizer`
6. Edge Function:
   - Fetches bill title and organizer's `expo_push_token` from `user_profiles`
   - Sends push via Expo Push API: *"[Name] just paid RM [amount] for [Bill title]"*

### Schema Addition

Add to `user_profiles`:

```sql
expo_push_token TEXT
```

### Edge Function: `notify-organizer`

Input payload (from pg_net POST):

```json
{
  "participant_id": "uuid",
  "bill_id": "uuid"
}
```

Logic:
- Join `participants` → `bills` → `user_profiles` on `bills.organizer_id = user_profiles.id`
- If `expo_push_token` is null, exit silently
- POST to `https://exp.host/--/api/v2/push/send` with title, body, and token

---

## Section 3 — App Changes

### Push Token Registration

In `profileStore.loadProfile()`, after the profile is loaded/created:

```ts
import * as Notifications from 'expo-notifications';

const { data: token } = await Notifications.getExpoPushTokenAsync();
if (token.data !== profile.expoPushToken) {
  await upsertProfile({ id: userId, expoPushToken: token.data });
}
```

Add `expoPushToken?: string` to the `UserProfile` type.

Update `rowToProfile()` in `supabase.ts` to map `expo_push_token`.

### Bill Store Verification

Confirm `billStore.createBill()` always sets `organizer_id` from `session.user.id`. No hardcoded strings.

### Permissions

Request push notification permissions on first login (iOS requires explicit prompt).

---

## Data Flow Summary

```
User logs in
  → profileStore saves Expo push token to user_profiles

User creates bill
  → bill.organizer_id = auth.uid() (enforced by RLS)

Participant opens share link (no auth)
  → public SELECT allowed on participants, line_items, share_links

Participant pays
  → participants.is_paid = true
  → DB trigger fires → Edge Function → push to organizer
```

---

## Out of Scope

- In-app notification inbox
- Email/WhatsApp notification on payment (covered by existing reminders feature)
- Multi-organizer bills
