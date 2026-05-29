# Profile, Auth & Security — Design Spec
**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** Google Sign-In, Profile screen (all sections), Security gating, Dark mode system

---

## 1. Overview

Implement Phase 2 of GoCheck: full user authentication via Google Sign-In (Supabase OAuth), a fully functional Profile screen matching the provided design mockups, app-level security gating (biometric + PIN + auto-lock), and a complete dark mode system.

---

## 2. Architecture

### Storage Strategy — Hybrid (Approach C)

| Data | Storage | Reason |
|---|---|---|
| Security settings (PIN hash, biometric enabled, auto-lock duration) | `expo-secure-store` on-device | Never leaves the phone — security credentials must stay local |
| All other preferences (notifications, payment methods, dark mode, currency, offline mode) | Supabase `user_profiles` table | Cross-device sync; restored on reinstall |
| Auth session | Supabase AsyncStorage adapter | Standard Supabase session persistence |

### New Files

```
app/
  auth/
    sign-in.tsx              # Google Sign-In landing screen
  lock.tsx                   # Lock screen (PIN + biometric gate)
  (modals)/
    pin-setup.tsx            # Set / change 4-digit PIN
    auto-lock-settings.tsx   # Choose idle timeout

src/
  store/
    profileStore.ts          # Zustand store for UserProfile
  theme/
    ThemeContext.tsx          # ThemeProvider + useTheme() hook
    darkTokens.ts            # Dark mode color overrides
```

### Modified Files

```
app/_layout.tsx              # Add ThemeProvider, AppState auto-lock listener, auth guard
app/(tabs)/profile.tsx       # Full implementation (currently placeholder)
src/theme/tokens.ts          # Add dark mode tokens
src/types/index.ts           # Add UserProfile, SecuritySettings, PaymentMethodKey types
src/lib/supabase.ts          # Add profile CRUD queries
supabase/migrations/         # New migration: user_profiles table
```

---

## 3. Auth Flow

1. App launches → root layout checks Supabase session via `onAuthStateChange`
2. **No session** → redirect to `app/auth/sign-in`
3. **Sign in with Google** → Supabase OAuth (`provider: 'google'`) → session created → fetch `user_profiles` row (create if first login) → redirect to `(tabs)`
4. **Has session + biometric or PIN enabled** → redirect to `app/lock` first
5. **Lock passed** → land on `(tabs)/index`

### Sign-In Screen (`app/auth/sign-in.tsx`)

- App logo + "GoCheck" centered
- Tagline: "Split bills. Stay organized."
- Google Sign-In button styled with app's indigo primary (`#4F46E5` light / `#6366F1` dark)
- Background: `#F8F9FF` light / radial gradient `#0A0A0F → #13131A` dark
- No email/password — Google only

---

## 4. Security Gating

### Lock Screen (`app/lock.tsx`)

- Header: app logo + "Welcome back, [displayName]"
- **Biometric enabled**: auto-triggers `LocalAuthentication.authenticateAsync()` on mount
- **PIN enabled**: 4-dot indicator + custom number pad (0–9, delete)
- **Both enabled**: biometric fires first; failure/cancel falls back to PIN pad
- Wrong PIN 5× → 30-second cooldown with visible countdown
- "Sign out" escape link at bottom
- Dark mode aware

### PIN Setup Modal (`app/(modals)/pin-setup.tsx`)

- Step 1: Enter new 4-digit PIN (dots fill as user taps)
- Step 2: Confirm PIN — must match exactly
- On confirm: hash PIN with SHA-256, store in `expo-secure-store` key `gocheck_pin_hash`
- Set `gocheck_pin_enabled` = `"true"`
- Cancel mid-flow → toggle reverts to off in profile screen

### Auto-Lock Settings Modal (`app/(modals)/auto-lock-settings.tsx`)

- Radio list: 1 min / 5 min / 15 min / 30 min / Never
- Current selection highlighted in indigo
- Stored in `expo-secure-store` key `gocheck_autolock_duration` (seconds; -1 = Never)
- Profile subtitle updates to reflect selection ("After 5 min idle")

### Auto-Lock Mechanism (root layout)

- `AppState` listener tracks timestamp of last foreground state
- On resume: `if (Date.now() - lastActive > autoLockDuration * 1000)` → navigate to `lock`
- `lastActive` stored in memory only — intentional so closing app always triggers lock check

### SecureStore Keys

| Key | Type | Description |
|---|---|---|
| `gocheck_pin_hash` | SHA-256 hex | PIN verification hash |
| `gocheck_pin_enabled` | `"true"/"false"` | PIN gate active |
| `gocheck_biometric_enabled` | `"true"/"false"` | Biometric gate active |
| `gocheck_autolock_duration` | number string (seconds) | -1 = Never |

---

## 5. Profile Screen (`app/(tabs)/profile.tsx`)

### Header

- Google profile photo (from `user_metadata.avatar_url`) with fallback to colored initials circle (uses existing `avatarColors` from tokens)
- Display name (editable — tapping opens a bottom sheet modal with a single text input; saves to `user_profiles.display_name`)
- Role label: "Organizer" + email (read-only, Google-managed)

### SECURITY Section

| Row | Type | Behaviour |
|---|---|---|
| Biometric unlock | Toggle | On enable: prompt `LocalAuthentication` to verify support; revert if unsupported |
| PIN code | Toggle + "Active" badge | Toggle on → navigate to `pin-setup`; toggle off → confirm current PIN first |
| Auto-lock | Chevron row | Tap → navigate to `auto-lock-settings`; subtitle shows current duration |

### NOTIFICATIONS Section (all saved to Supabase `user_profiles`)

| Row | Subtitle | Type |
|---|---|---|
| Push notifications | — | Toggle; on enable calls `expo-notifications` permission request |
| Email alerts | — | Toggle |
| WhatsApp linked | Send reminders via WhatsApp | Toggle; enables existing `ReminderChannel` whatsapp |
| Due-soon alerts | 3 days before each bill is due | Toggle |
| Overdue alerts | — | Toggle |
| Weekly digest | Sundays at 6 PM | Toggle |

### PAYMENT METHODS Section (saved as array in `user_profiles.payment_methods`)

| Row | Key |
|---|---|
| UPI · HDFC | `upi_hdfc` |
| Card via Stripe | `card_stripe` |
| PayPal | `paypal` |
| Bank Transfer | `bank_transfer` |

Each row: icon + label + subtitle (account identifier if applicable) + toggle. Enabled state saved to `user_profiles.payment_methods` array. Integration into the bill payment flow is out of scope for this spec.

### BILLS Section

| Row | Type | Behaviour |
|---|---|---|
| Recurring bills | Chevron | Tap → existing `reminders` modal; subtitle: active count |
| Default currency | Chevron + value | Tap → currency picker bottom sheet; uses existing `Currency` type |
| Dark mode | Toggle | Immediately switches theme; saved to `user_profiles.dark_mode` |

### CONNECTIVITY Section

| Row | Subtitle | Type |
|---|---|---|
| Offline mode | Queue actions until back online | Toggle; saved to `user_profiles.offline_mode` |

### Sign Out

- Indigo outlined button at bottom of scroll
- Confirmation alert before signing out
- Clears Supabase session + resets profile store

---

## 6. Dark Mode System

### Theme Context (`src/theme/ThemeContext.tsx`)

- `ThemeProvider` wraps entire app in `app/_layout.tsx`
- `useTheme()` hook exposes `{ isDark, colors, toggleDark }`
- `colors` maps all design tokens to light or dark values
- Initial value from `user_profiles.dark_mode` on auth; saved back on toggle

### Dark Color Tokens

| Token | Light | Dark |
|---|---|---|
| `background` | `#F8F9FF` | `#0A0A0F` |
| `surface` | `#FFFFFF` | `#13131A` |
| `surfaceElevated` | `#F9FAFB` | `#1C1C28` |
| `surfaceHighlight` | `#F3F4F6` | `#252535` |
| `textPrimary` | `#111827` | `#F1F1F5` |
| `textSecondary` | `#6B7280` | `#8B8BA8` |
| `textMuted` | `#9CA3AF` | `#4A4A68` |
| `border` | `#E5E7EB` | `rgba(255,255,255,0.08)` |
| `divider` | `#F3F4F6` | `#1E1E2D` |
| `primary` | `#4F46E5` | `#6366F1` |

- Toggle track: `#6366F1` (on) / `#2E2E45` (off) in dark mode
- Icon backgrounds: `rgba(99,102,241,0.15)` tinted in dark mode
- Section header rows: `rgba(255,255,255,0.04)` tint in dark mode

### Transition

- 180ms `Animated.timing` fade on background and surface colors
- Status bar style switches via `expo-status-bar`
- All new screens built dark-mode-aware; existing screens updated progressively

---

## 7. Data Layer

### Supabase Migration — `user_profiles`

```sql
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text default 'MYR',
  dark_mode boolean default false,
  offline_mode boolean default false,
  payment_methods text[] default '{}',
  notif_push boolean default true,
  notif_email boolean default true,
  notif_whatsapp boolean default false,
  notif_due_soon boolean default true,
  notif_overdue boolean default true,
  notif_weekly_digest boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table user_profiles enable row level security;

create policy "users can manage own profile"
  on user_profiles
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

### Zustand Store — `src/store/profileStore.ts`

- State: `profile: UserProfile | null`, `isLoading: boolean`, `error: string | null`
- `fetchProfile()` — load from Supabase on login
- `updateProfile(partial)` — optimistic local update + Supabase patch
- `updateSecuritySetting(key, value)` — writes to SecureStore only
- `signOut()` — clear session + reset store

### New Types (`src/types/index.ts`)

```ts
interface UserProfile {
  id: string
  displayName: string
  avatarUrl: string | null
  defaultCurrency: Currency
  darkMode: boolean
  offlineMode: boolean
  paymentMethods: PaymentMethodKey[]
  notifPush: boolean
  notifEmail: boolean
  notifWhatsapp: boolean
  notifDueSoon: boolean
  notifOverdue: boolean
  notifWeeklyDigest: boolean
}

type PaymentMethodKey = 'upi_hdfc' | 'card_stripe' | 'paypal' | 'bank_transfer'

interface SecuritySettings {
  pinEnabled: boolean
  biometricEnabled: boolean
  autoLockDuration: number // seconds; -1 = never
}
```

---

## 8. Dependencies to Add

| Package | Purpose |
|---|---|
| `expo-local-authentication` | Biometric (Face ID / Touch ID) |
| `expo-secure-store` | PIN hash + security settings storage |
| `expo-notifications` | Push notification permission + scheduling |
| `@supabase/supabase-js` | Already installed — OAuth flow |
| `expo-crypto` | SHA-256 PIN hashing |

---

## 9. Out of Scope

- Actual payment processing (Stripe/PayPal/UPI charges) — payment methods are labels only
- Email/password sign-in — Google only
- WhatsApp Business API integration — toggle enables existing reminder channel only
- Offline queue implementation — toggle saved as preference only in this phase
