# Profile, Auth & Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Google Sign-In via Supabase OAuth, a fully functional Profile screen with all settings sections, app-level security gating (biometric + PIN + auto-lock), and a complete dark mode system.

**Architecture:** Hybrid storage — security credentials (PIN hash, biometric flag, auto-lock duration) stay in `expo-secure-store` on-device only; all other preferences sync via Supabase `user_profiles` table. A `ThemeContext` wraps the entire app and provides theme-aware `colors` to all new screens. Auth state is managed by a `profileStore` (Zustand) that listens to `supabase.auth.onAuthStateChange`.

**Tech Stack:** Expo 51, Expo Router v3.5, Zustand v4.5, Supabase JS v2, expo-secure-store, expo-local-authentication, expo-notifications, expo-crypto, expo-web-browser, React Native StyleSheet

---

## Pre-requisites (manual setup — do before coding)

1. In Supabase dashboard → Authentication → Providers → enable Google, add your Google OAuth Client ID + Secret
2. In Google Cloud Console → OAuth credentials → add redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. Note your `app.json` scheme (set to `gocheck` in Task 1 below) — add `gocheck://` as an allowed redirect URI in Supabase dashboard → URL Configuration → Redirect URLs

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/index.ts` | Modify | Add UserProfile, SecuritySettings, PaymentMethodKey types |
| `supabase/migrations/004_user_profiles.sql` | Create | user_profiles table + RLS policies |
| `src/lib/supabase.ts` | Modify | Add getProfile and upsertProfile functions (upsert handles both insert and update) |
| `src/store/profileStore.ts` | Create | Zustand store: session, profile, security state + actions |
| `src/theme/ThemeContext.tsx` | Create | ThemeProvider + useTheme() hook |
| `app/_layout.tsx` | Modify | Add ThemeProvider, auth guard, auto-lock AppState listener, new Stack.Screens |
| `app/auth/_layout.tsx` | Create | Stack layout for auth routes (headerShown: false) |
| `app/auth/sign-in.tsx` | Create | Google Sign-In landing screen |
| `app/lock.tsx` | Create | Lock screen — biometric + PIN gate |
| `app/(modals)/pin-setup.tsx` | Create | 2-step PIN creation/change flow |
| `app/(modals)/auto-lock-settings.tsx` | Create | Auto-lock duration picker |
| `app/(tabs)/profile.tsx` | Modify (replace) | Full Profile screen with all sections |
| `__tests__/profileStore.test.ts` | Create | Unit tests for store actions |
| `__tests__/ThemeContext.test.tsx` | Create | Unit tests for theme toggle |
| `app.json` | Modify | Add scheme, notification permissions |

---

## Task 1: Install packages and configure app.json

**Files:**
- Modify: `package.json` (via npx expo install)
- Modify: `app.json`

- [ ] **Step 1: Install expo packages with correct SDK versions**

```bash
npx expo install expo-secure-store expo-local-authentication expo-notifications expo-crypto expo-web-browser
```

Expected output: packages added to `node_modules` and `package.json` with `~` versions compatible with Expo 51.

- [ ] **Step 2: Verify package.json has all five new packages**

```bash
grep -E "expo-secure-store|expo-local-authentication|expo-notifications|expo-crypto|expo-web-browser" package.json
```

Expected: 5 lines, each showing the new package with a version.

- [ ] **Step 3: Add scheme and notification permissions to app.json**

Open `app.json`. Add `"scheme": "gocheck"` at the top level of the `expo` object (alongside `"name"`, `"slug"`, etc.). Also add notification permissions for iOS and Android:

```json
{
  "expo": {
    "name": "GoCheck",
    "slug": "gocheck",
    "scheme": "gocheck",
    "ios": {
      "infoPlist": {
        "NSFaceIDUsageDescription": "GoCheck uses Face ID to protect your account.",
        "NSCameraUsageDescription": "GoCheck uses your camera to add group photos."
      }
    },
    "android": {
      "permissions": [
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#4F46E5",
          "sounds": []
        }
      ],
      "expo-secure-store"
    ]
  }
}
```

Note: if `assets/notification-icon.png` does not exist, copy any existing icon file there temporarily, or remove the `icon` line from the notifications plugin config.

- [ ] **Step 4: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: install expo-secure-store, local-auth, notifications, crypto, web-browser"
```

---

## Task 2: Add types to src/types/index.ts

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Append new types at the bottom of src/types/index.ts**

Add the following after the last line of the file:

```ts
// ─── Profile & Auth ────────────────────────────────────────────────────────────

export type PaymentMethodKey = 'upi_hdfc' | 'card_stripe' | 'paypal' | 'bank_transfer';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKey, string> = {
  upi_hdfc: 'UPI · HDFC',
  card_stripe: 'Card via Stripe',
  paypal: 'PayPal',
  bank_transfer: 'Bank Transfer',
};

export const PAYMENT_METHOD_SUBTITLES: Record<PaymentMethodKey, string> = {
  upi_hdfc: 'rahul@okhdfс',
  card_stripe: 'Visa ending 4242',
  paypal: 'paypal.me/user',
  bank_transfer: 'Direct bank transfer',
};

export interface UserProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  defaultCurrency: Currency;
  darkMode: boolean;
  offlineMode: boolean;
  paymentMethods: PaymentMethodKey[];
  notifPush: boolean;
  notifEmail: boolean;
  notifWhatsapp: boolean;
  notifDueSoon: boolean;
  notifOverdue: boolean;
  notifWeeklyDigest: boolean;
}

export interface SecuritySettings {
  pinEnabled: boolean;
  biometricEnabled: boolean;
  autoLockDuration: number; // seconds; -1 = never
}

export const AUTO_LOCK_OPTIONS: { label: string; value: number }[] = [
  { label: '1 minute', value: 60 },
  { label: '5 minutes', value: 300 },
  { label: '15 minutes', value: 900 },
  { label: '30 minutes', value: 1800 },
  { label: 'Never', value: -1 },
];

export function autoLockLabel(seconds: number): string {
  const option = AUTO_LOCK_OPTIONS.find(o => o.value === seconds);
  if (option) return seconds === -1 ? 'Never' : `After ${option.label} idle`;
  return 'After 5 minutes idle';
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add UserProfile, SecuritySettings, PaymentMethodKey types"
```

---

## Task 3: Create Supabase migration for user_profiles

**Files:**
- Create: `supabase/migrations/004_user_profiles.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/004_user_profiles.sql` with this content:

```sql
-- user_profiles: stores per-user preferences synced across devices
-- Security settings (PIN, biometric) are stored on-device only and never here.

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  default_currency text not null default 'MYR',
  dark_mode boolean not null default false,
  offline_mode boolean not null default false,
  payment_methods text[] not null default '{}',
  notif_push boolean not null default true,
  notif_email boolean not null default true,
  notif_whatsapp boolean not null default false,
  notif_due_soon boolean not null default true,
  notif_overdue boolean not null default true,
  notif_weekly_digest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only the owning user can read or write their profile row
alter table public.user_profiles enable row level security;

create policy "users can manage own profile"
  on public.user_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-update updated_at on any row change
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.handle_updated_at();
```

- [ ] **Step 2: Apply the migration to your Supabase project**

If using Supabase CLI with linked project:
```bash
supabase db push
```

If applying manually via Supabase dashboard: go to SQL Editor, paste the SQL above, and run it.

- [ ] **Step 3: Verify the table exists**

In Supabase dashboard → Table Editor → confirm `user_profiles` table is visible with all columns.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/004_user_profiles.sql
git commit -m "feat: add user_profiles table with RLS"
```

---

## Task 4: Add profile queries to src/lib/supabase.ts

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Append profile query functions to the end of src/lib/supabase.ts**

```ts
// ─── Profile Operations ────────────────────────────────────────────────────────

import type { UserProfile } from '../types';

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    displayName: (row.display_name as string) ?? '',
    avatarUrl: (row.avatar_url as string) ?? null,
    defaultCurrency: (row.default_currency as UserProfile['defaultCurrency']) ?? 'MYR',
    darkMode: Boolean(row.dark_mode),
    offlineMode: Boolean(row.offline_mode),
    paymentMethods: (row.payment_methods as UserProfile['paymentMethods']) ?? [],
    notifPush: Boolean(row.notif_push),
    notifEmail: Boolean(row.notif_email),
    notifWhatsapp: Boolean(row.notif_whatsapp),
    notifDueSoon: Boolean(row.notif_due_soon),
    notifOverdue: Boolean(row.notif_overdue),
    notifWeeklyDigest: Boolean(row.notif_weekly_digest),
  };
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data) : null;
}

export async function upsertProfile(profile: Partial<UserProfile> & { id: string }): Promise<UserProfile> {
  const row: Record<string, unknown> = { id: profile.id };
  if (profile.displayName !== undefined) row.display_name = profile.displayName;
  if (profile.avatarUrl !== undefined) row.avatar_url = profile.avatarUrl;
  if (profile.defaultCurrency !== undefined) row.default_currency = profile.defaultCurrency;
  if (profile.darkMode !== undefined) row.dark_mode = profile.darkMode;
  if (profile.offlineMode !== undefined) row.offline_mode = profile.offlineMode;
  if (profile.paymentMethods !== undefined) row.payment_methods = profile.paymentMethods;
  if (profile.notifPush !== undefined) row.notif_push = profile.notifPush;
  if (profile.notifEmail !== undefined) row.notif_email = profile.notifEmail;
  if (profile.notifWhatsapp !== undefined) row.notif_whatsapp = profile.notifWhatsapp;
  if (profile.notifDueSoon !== undefined) row.notif_due_soon = profile.notifDueSoon;
  if (profile.notifOverdue !== undefined) row.notif_overdue = profile.notifOverdue;
  if (profile.notifWeeklyDigest !== undefined) row.notif_weekly_digest = profile.notifWeeklyDigest;

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(row, { onConflict: 'id' })
    .select()
    .single();
  if (error) throw error;
  return rowToProfile(data);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add getProfile and upsertProfile queries"
```

---

## Task 5: Create src/store/profileStore.ts

**Files:**
- Create: `src/store/profileStore.ts`
- Create: `__tests__/profileStore.test.ts`

- [ ] **Step 1: Write the failing tests first**

Create `__tests__/profileStore.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react-hooks';
import { useProfileStore } from '../src/store/profileStore';

// Mock supabase
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  },
  getProfile: jest.fn(),
  upsertProfile: jest.fn(),
}));

// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('profileStore', () => {
  beforeEach(() => {
    useProfileStore.setState({
      session: null,
      profile: null,
      security: { pinEnabled: false, biometricEnabled: false, autoLockDuration: 300 },
      isLoading: false,
      isUnlocked: false,
      error: null,
    });
  });

  it('starts with no session and no profile', () => {
    const { result } = renderHook(() => useProfileStore());
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('updateProfile optimistically updates local state', async () => {
    const { upsertProfile } = require('../src/lib/supabase');
    const mockProfile = {
      id: 'user-1', displayName: 'Test', avatarUrl: null,
      defaultCurrency: 'MYR' as const, darkMode: false, offlineMode: false,
      paymentMethods: [], notifPush: true, notifEmail: true,
      notifWhatsapp: false, notifDueSoon: true, notifOverdue: true, notifWeeklyDigest: false,
    };
    upsertProfile.mockResolvedValue({ ...mockProfile, darkMode: true });

    useProfileStore.setState({ profile: mockProfile, session: { user: { id: 'user-1' } } as any });

    const { result } = renderHook(() => useProfileStore());
    await act(async () => {
      await result.current.updateProfile({ darkMode: true });
    });

    expect(result.current.profile?.darkMode).toBe(true);
  });

  it('updateSecuritySetting saves to SecureStore', async () => {
    const SecureStore = require('expo-secure-store');
    const { result } = renderHook(() => useProfileStore());

    await act(async () => {
      await result.current.updateSecuritySetting('pinEnabled', true);
    });

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('gocheck_pin_enabled', 'true');
    expect(result.current.security.pinEnabled).toBe(true);
  });

  it('signOut clears session and profile', async () => {
    useProfileStore.setState({
      session: { user: { id: 'u1' } } as any,
      profile: { id: 'u1' } as any,
    });
    const { result } = renderHook(() => useProfileStore());
    await act(async () => { await result.current.signOut(); });
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests — expect failures (store doesn't exist yet)**

```bash
npx jest __tests__/profileStore.test.ts --no-coverage
```

Expected: FAIL — "Cannot find module '../src/store/profileStore'"

- [ ] **Step 3: Create src/store/profileStore.ts**

```ts
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { supabase, getProfile, upsertProfile } from '../lib/supabase';
import type { UserProfile, SecuritySettings } from '../types';

const SECURE_KEYS = {
  pinHash: 'gocheck_pin_hash',
  pinEnabled: 'gocheck_pin_enabled',
  biometricEnabled: 'gocheck_biometric_enabled',
  autoLockDuration: 'gocheck_autolock_duration',
} as const;

interface ProfileStore {
  session: Session | null;
  profile: UserProfile | null;
  security: SecuritySettings;
  isLoading: boolean;
  isUnlocked: boolean;
  error: string | null;

  initializeAuth: () => () => void;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
  updateSecuritySetting: (key: keyof SecuritySettings, value: boolean | number) => Promise<void>;
  loadSecuritySettings: () => Promise<void>;
  setUnlocked: (val: boolean) => void;
  signOut: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  session: null,
  profile: null,
  security: { pinEnabled: false, biometricEnabled: false, autoLockDuration: 300 },
  isLoading: false,
  isUnlocked: false,
  error: null,

  initializeAuth: () => {
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      set({ session });
      if (session?.user) {
        await get().fetchProfile(session.user.id);
        await get().loadSecuritySettings();
      } else {
        set({ profile: null, isUnlocked: false });
      }
    });
    return () => data.subscription.unsubscribe();
  },

  fetchProfile: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      let profile = await getProfile(userId);
      if (!profile) {
        // First login — create profile from Google metadata
        const { data: { user } } = await supabase.auth.getUser();
        profile = await upsertProfile({
          id: userId,
          displayName: user?.user_metadata?.full_name ?? user?.email ?? 'User',
          avatarUrl: user?.user_metadata?.avatar_url ?? null,
        });
      }
      set({ profile, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  updateProfile: async (partial) => {
    const { profile } = get();
    if (!profile) return;
    // Optimistic update
    set({ profile: { ...profile, ...partial } });
    try {
      const updated = await upsertProfile({ ...profile, ...partial });
      set({ profile: updated });
    } catch (e) {
      // Revert on failure
      set({ profile, error: String(e) });
    }
  },

  updateSecuritySetting: async (key, value) => {
    const secureKeyMap: Record<keyof SecuritySettings, string> = {
      pinEnabled: SECURE_KEYS.pinEnabled,
      biometricEnabled: SECURE_KEYS.biometricEnabled,
      autoLockDuration: SECURE_KEYS.autoLockDuration,
    };
    await SecureStore.setItemAsync(secureKeyMap[key], String(value));
    set(s => ({ security: { ...s.security, [key]: value } }));
  },

  loadSecuritySettings: async () => {
    const [pinEnabled, biometricEnabled, autoLockDuration] = await Promise.all([
      SecureStore.getItemAsync(SECURE_KEYS.pinEnabled),
      SecureStore.getItemAsync(SECURE_KEYS.biometricEnabled),
      SecureStore.getItemAsync(SECURE_KEYS.autoLockDuration),
    ]);
    set({
      security: {
        pinEnabled: pinEnabled === 'true',
        biometricEnabled: biometricEnabled === 'true',
        autoLockDuration: autoLockDuration ? parseInt(autoLockDuration, 10) : 300,
      },
    });
  },

  setUnlocked: (val) => set({ isUnlocked: val }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null, isUnlocked: false, error: null });
  },
}));

export { SECURE_KEYS };
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/profileStore.test.ts --no-coverage
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/store/profileStore.ts __tests__/profileStore.test.ts
git commit -m "feat: add profileStore with session, profile, and security management"
```

---

## Task 6: Create src/theme/ThemeContext.tsx

**Files:**
- Create: `src/theme/ThemeContext.tsx`
- Create: `__tests__/ThemeContext.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/ThemeContext.test.tsx`:

```tsx
import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>{children}</ThemeProvider>
);

describe('ThemeContext', () => {
  it('starts in light mode', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.isDark).toBe(false);
    expect(result.current.colors.background).toBe('#F8F9FF');
  });

  it('toggleDark switches to dark mode colors', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.toggleDark(); });
    expect(result.current.isDark).toBe(true);
    expect(result.current.colors.background).toBe('#0A0A0F');
    expect(result.current.colors.surface).toBe('#13131A');
  });

  it('toggleDark twice returns to light mode', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => { result.current.toggleDark(); });
    act(() => { result.current.toggleDark(); });
    expect(result.current.isDark).toBe(false);
  });

  it('throws when used outside ThemeProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useTheme())).toThrow();
    consoleError.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx jest __tests__/ThemeContext.test.tsx --no-coverage
```

Expected: FAIL — "Cannot find module '../src/theme/ThemeContext'"

- [ ] **Step 3: Create src/theme/ThemeContext.tsx**

```tsx
import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import { colors as lightColors } from './tokens';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  textInverse: string;
  textAccent: string;
  border: string;
  borderFocus: string;
  divider: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primarySurface: string;
  primaryBorder: string;
  error: string;
  errorSurface: string;
  success: string;
  successSurface: string;
  warning: string;
  warningSurface: string;
  iconSurface: string;
  white: string;
  black: string;
  transparent: string;
}

const LIGHT: ThemeColors = {
  background: '#F8F9FF',
  surface: '#FFFFFF',
  surfaceElevated: '#F9FAFB',
  surfaceHighlight: '#F3F4F6',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textDisabled: '#D1D5DB',
  textInverse: '#FFFFFF',
  textAccent: '#4F46E5',
  border: '#E5E7EB',
  borderFocus: '#4F46E5',
  divider: '#F3F4F6',
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#6366F1',
  primarySurface: '#EEF2FF',
  primaryBorder: '#C7D2FE',
  error: '#EF4444',
  errorSurface: '#FEF2F2',
  success: '#10B981',
  successSurface: '#ECFDF5',
  warning: '#F59E0B',
  warningSurface: '#FFFBEB',
  iconSurface: '#EEF2FF',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

const DARK: ThemeColors = {
  background: '#0A0A0F',
  surface: '#13131A',
  surfaceElevated: '#1C1C28',
  surfaceHighlight: '#252535',
  textPrimary: '#F1F1F5',
  textSecondary: '#8B8BA8',
  textTertiary: '#5A5A78',
  textDisabled: '#3A3A55',
  textInverse: '#0A0A0F',
  textAccent: '#818CF8',
  border: 'rgba(255,255,255,0.08)',
  borderFocus: '#6366F1',
  divider: '#1E1E2D',
  primary: '#6366F1',
  primaryDark: '#4F46E5',
  primaryLight: '#818CF8',
  primarySurface: 'rgba(99,102,241,0.12)',
  primaryBorder: 'rgba(99,102,241,0.25)',
  error: '#F87171',
  errorSurface: 'rgba(248,113,113,0.12)',
  success: '#34D399',
  successSurface: 'rgba(52,211,153,0.12)',
  warning: '#FBBF24',
  warningSurface: 'rgba(251,191,36,0.12)',
  iconSurface: 'rgba(99,102,241,0.15)',
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  toggleDark: () => void;
  setDark: (val: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({
  children,
  initialDark = false,
}: {
  children: React.ReactNode;
  initialDark?: boolean;
}) {
  const [isDark, setIsDark] = useState(initialDark);

  const toggleDark = useCallback(() => setIsDark(v => !v), []);
  const setDark = useCallback((val: boolean) => setIsDark(val), []);
  const colors = useMemo(() => (isDark ? DARK : LIGHT), [isDark]);

  const value = useMemo(
    () => ({ isDark, colors, toggleDark, setDark }),
    [isDark, colors, toggleDark, setDark],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

export { LIGHT as lightColors, DARK as darkColors };
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx jest __tests__/ThemeContext.test.tsx --no-coverage
```

Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/theme/ThemeContext.tsx __tests__/ThemeContext.test.tsx
git commit -m "feat: add ThemeContext with light/dark color system"
```

---

## Task 7: Update app/_layout.tsx

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Replace app/_layout.tsx with the full updated version**

This version adds: ThemeProvider wrapping, auth guard, auto-lock AppState listener, and new Stack.Screens for auth + lock + pin-setup + auto-lock-settings.

```tsx
import { useEffect, useRef, useCallback } from 'react';
import { Platform, View, StyleSheet, AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from '@expo-google-fonts/dm-mono';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useProfileStore } from '../src/store/profileStore';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { colors, isDark, setDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const { session, isUnlocked, security, initializeAuth, setUnlocked } = useProfileStore();
  const lastActiveRef = useRef<number | null>(null);
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  // Initialize Supabase auth listener once
  useEffect(() => {
    const cleanup = initializeAuth();
    return cleanup;
  }, []);

  // Sync dark mode from profile to ThemeContext
  const { profile } = useProfileStore();
  useEffect(() => {
    if (profile) setDark(profile.darkMode);
  }, [profile?.darkMode]);

  // Auth guard
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const inAuthGroup = segments[0] === 'auth';
    const inLock = segments[0] === 'lock';

    if (!session && !inAuthGroup) {
      router.replace('/auth/sign-in');
      return;
    }

    if (session && !inAuthGroup && !inLock) {
      const needsLock = (security.pinEnabled || security.biometricEnabled) && !isUnlocked;
      if (needsLock) {
        router.replace('/lock');
      }
    }
  }, [session, segments, isUnlocked, security, fontsLoaded, fontError]);

  // Auto-lock on AppState change
  const checkAutoLock = useCallback(async () => {
    if (!session || !isUnlocked) return;
    const durationStr = await SecureStore.getItemAsync('gocheck_autolock_duration');
    const duration = durationStr ? parseInt(durationStr, 10) : 300;
    if (duration === -1 || lastActiveRef.current === null) return;
    const elapsed = (Date.now() - lastActiveRef.current) / 1000;
    if (elapsed >= duration) {
      setUnlocked(false);
      router.replace('/lock');
    }
  }, [session, isUnlocked]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        lastActiveRef.current = Date.now();
      } else if (nextState === 'active') {
        checkAutoLock();
      }
    });
    return () => sub.remove();
  }, [checkAutoLock]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const app = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: Platform.OS === 'web' ? 'none' : 'default',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="lock" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="(modals)/create"
        options={{
          presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal',
          animation: Platform.OS === 'web' ? 'fade' : 'slide_from_bottom',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="(modals)/bill/[id]"
        options={{ presentation: 'card', animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/share/[code]"
        options={{ presentation: 'card', animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/reminders"
        options={{ presentation: 'card', animation: Platform.OS === 'web' ? 'none' : 'slide_from_right', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/pin-setup"
        options={{ presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal', animation: 'slide_from_bottom', headerShown: false }}
      />
      <Stack.Screen
        name="(modals)/auto-lock-settings"
        options={{ presentation: Platform.OS === 'web' ? 'transparentModal' : 'modal', animation: 'slide_from_bottom', headerShown: false }}
      />
    </Stack>
  );

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      {Platform.OS === 'web' ? (
        <View style={[styles.webContainer, { backgroundColor: isDark ? '#000' : '#E5E7EB' }]}>
          <View style={[styles.webPhone, { backgroundColor: colors.background }]}>{app}</View>
        </View>
      ) : (
        app
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  webContainer: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
  webPhone: {
    width: '100%',
    maxWidth: 430,
    flex: 1,
    overflow: 'hidden',
    // @ts-ignore — web-only shadow
    boxShadow: '0 0 0 1px rgba(0,0,0,0.06), 0 8px 48px rgba(0,0,0,0.14)',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: add ThemeProvider, auth guard, and auto-lock to root layout"
```

---

## Task 8: Create auth screens (sign-in with Google OAuth)

**Files:**
- Create: `app/auth/_layout.tsx`
- Create: `app/auth/sign-in.tsx`

- [ ] **Step 1: Create app/auth/_layout.tsx**

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Create app/auth/sign-in.tsx**

```tsx
import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Dimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const redirectTo = Linking.createURL('/auth/callback');
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (oauthError) throw oauthError;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success') {
        const url = result.url;
        // Extract tokens from URL fragment (implicit flow) or exchange code (PKCE)
        const { data: sessionData, error: sessionError } =
          await supabase.auth.exchangeCodeForSession(url);
        if (sessionError) {
          // Fallback: session may already be set via onAuthStateChange
          console.warn('[Auth] exchangeCodeForSession:', sessionError.message);
        }
      }
    } catch (e) {
      setError('Sign in failed. Please try again.');
      console.error('[Auth] Google sign in error:', e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Logo area */}
      <View style={styles.logoArea}>
        <View style={styles.logoCircle}>
          <Feather name="check-circle" size={40} color="#FFFFFF" />
        </View>
        <Text style={styles.appName}>GoCheck</Text>
        <Text style={styles.tagline}>Split bills. Stay organized.</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Welcome</Text>
        <Text style={styles.cardSubtitle}>Sign in to manage and split bills with your group.</Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <>
              {/* Google G icon using SVG-like placeholder via Feather */}
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing, you agree to GoCheck's Terms of Service and Privacy Policy.
        </Text>
      </View>

      {/* Bottom decoration */}
      <View style={styles.bottomDecoration}>
        <View style={[styles.decorDot, { backgroundColor: colors.primary }]} />
        <View style={[styles.decorDot, { backgroundColor: colors.primaryBorder }]} />
        <View style={[styles.decorDot, { backgroundColor: colors.primarySurface }]} />
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing[6],
    },
    logoArea: { alignItems: 'center', marginBottom: spacing[10] },
    logoCircle: {
      width: 80,
      height: 80,
      borderRadius: radius['2xl'],
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing[4],
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 12,
    },
    appName: {
      fontFamily: typography.sansBold,
      fontSize: fontSize['3xl'],
      color: colors.textPrimary,
      letterSpacing: -0.5,
    },
    tagline: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.base,
      color: colors.textSecondary,
      marginTop: spacing[1],
    },
    card: {
      width: '100%',
      backgroundColor: colors.surface,
      borderRadius: radius['2xl'],
      padding: spacing[6],
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.06,
      shadowRadius: 16,
      elevation: 4,
    },
    cardTitle: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
      marginBottom: spacing[1],
    },
    cardSubtitle: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing[5],
      lineHeight: fontSize.sm * 1.6,
    },
    errorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing[1.5],
      backgroundColor: colors.errorSurface,
      borderRadius: radius.md,
      padding: spacing[3],
      marginBottom: spacing[3],
    },
    errorText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.error,
      flex: 1,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[3],
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      paddingVertical: spacing[4],
      paddingHorizontal: spacing[5],
    },
    googleButtonDisabled: { opacity: 0.7 },
    googleIcon: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    googleIconText: {
      fontFamily: typography.sansBold,
      fontSize: 13,
      color: colors.primary,
    },
    googleButtonText: {
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.base,
      color: colors.textInverse,
    },
    disclaimer: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize['2xs'],
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing[4],
      lineHeight: fontSize['2xs'] * 1.6,
    },
    bottomDecoration: {
      flexDirection: 'row',
      gap: spacing[1.5],
      marginTop: spacing[8],
    },
    decorDot: { width: 6, height: 6, borderRadius: 3 },
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/auth/_layout.tsx app/auth/sign-in.tsx
git commit -m "feat: add Google Sign-In screen via Supabase OAuth"
```

---

## Task 9: Create app/lock.tsx

**Files:**
- Create: `app/lock.tsx`

- [ ] **Step 1: Create app/lock.tsx**

```tsx
import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, Alert, StyleSheet,
  Vibration, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../src/theme/ThemeContext';
import { useProfileStore } from '../src/store/profileStore';
import { typography, fontSize, spacing, radius } from '../src/theme/tokens';

const MAX_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 30;

export default function LockScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, security, setUnlocked, signOut } = useProfileStore();
  const [pin, setPin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [bioLoading, setBioLoading] = useState(false);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Try biometric on mount if enabled
  useEffect(() => {
    if (security.biometricEnabled) {
      triggerBiometric();
    }
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function triggerBiometric() {
    setBioLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock GoCheck',
        fallbackLabel: 'Use PIN',
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setUnlocked(true);
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.warn('[Lock] Biometric error:', e);
    } finally {
      setBioLoading(false);
    }
  }

  async function handleDigit(digit: string) {
    if (cooldown > 0 || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      await verifyPin(newPin);
    }
  }

  async function verifyPin(enteredPin: string) {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      enteredPin,
    );
    const storedHash = await SecureStore.getItemAsync('gocheck_pin_hash');
    if (hash === storedHash) {
      setPin('');
      setAttempts(0);
      setUnlocked(true);
      router.replace('/(tabs)');
    } else {
      Vibration.vibrate(300);
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      if (newAttempts >= MAX_ATTEMPTS) {
        setCooldown(COOLDOWN_SECONDS);
        setAttempts(0);
      }
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1));
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  const dots = [0, 1, 2, 3].map(i => (
    <View
      key={i}
      style={[styles.dot, i < pin.length && styles.dotFilled]}
    />
  ));

  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.logoRow}>
        <View style={styles.logoCircle}>
          <Feather name="lock" size={24} color="#FFFFFF" />
        </View>
      </View>

      <Text style={styles.greeting}>
        Welcome back{profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : ''}
      </Text>
      <Text style={styles.subtitle}>Enter your PIN to continue</Text>

      {/* PIN dots */}
      <View style={styles.dotsRow}>{dots}</View>

      {attempts > 0 && attempts < MAX_ATTEMPTS && (
        <Text style={styles.attemptsText}>
          Incorrect PIN — {MAX_ATTEMPTS - attempts} attempt{MAX_ATTEMPTS - attempts !== 1 ? 's' : ''} left
        </Text>
      )}

      {cooldown > 0 && (
        <Text style={styles.cooldownText}>Too many attempts. Try again in {cooldown}s</Text>
      )}

      {/* Number pad */}
      <View style={[styles.numpad, cooldown > 0 && styles.numpadDisabled]}>
        {numpad.map((row, ri) => (
          <View key={ri} style={styles.numpadRow}>
            {row.map((key, ki) => {
              if (key === '') return <View key={ki} style={styles.numpadEmpty} />;
              if (key === 'del') {
                return (
                  <TouchableOpacity key={ki} style={styles.numpadKey} onPress={handleDelete} activeOpacity={0.6}>
                    <Feather name="delete" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                );
              }
              return (
                <TouchableOpacity
                  key={ki}
                  style={styles.numpadKey}
                  onPress={() => handleDigit(key)}
                  disabled={cooldown > 0}
                  activeOpacity={0.6}
                >
                  <Text style={styles.numpadKeyText}>{key}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>

      {/* Biometric button */}
      {security.biometricEnabled && (
        <TouchableOpacity style={styles.bioButton} onPress={triggerBiometric} disabled={bioLoading}>
          {bioLoading
            ? <ActivityIndicator color={colors.primary} size="small" />
            : <Feather name="aperture" size={22} color={colors.primary} />
          }
          <Text style={styles.bioText}>Use Face / Touch ID</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.signOutLink} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1, backgroundColor: colors.background,
      alignItems: 'center', justifyContent: 'center',
      paddingHorizontal: spacing[6],
    },
    logoRow: { marginBottom: spacing[6] },
    logoCircle: {
      width: 60, height: 60, borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center', justifyContent: 'center',
    },
    greeting: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
      marginBottom: spacing[1],
    },
    subtitle: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing[8],
    },
    dotsRow: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[3] },
    dot: {
      width: 14, height: 14, borderRadius: 7,
      borderWidth: 2, borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
    attemptsText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.xs,
      color: colors.error,
      marginBottom: spacing[4],
    },
    cooldownText: {
      fontFamily: typography.sansMedium,
      fontSize: fontSize.sm,
      color: colors.warning,
      marginBottom: spacing[4],
    },
    numpad: { width: '100%', maxWidth: 280, marginTop: spacing[4] },
    numpadDisabled: { opacity: 0.4 },
    numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
    numpadEmpty: { width: 72, height: 72 },
    numpadKey: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    numpadKeyText: {
      fontFamily: typography.sansMedium,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
    },
    bioButton: {
      flexDirection: 'row', alignItems: 'center', gap: spacing[2],
      marginTop: spacing[8],
      paddingVertical: spacing[3], paddingHorizontal: spacing[5],
      borderRadius: radius.lg,
      backgroundColor: colors.primarySurface,
      borderWidth: 1, borderColor: colors.primaryBorder,
    },
    bioText: {
      fontFamily: typography.sansMedium,
      fontSize: fontSize.sm,
      color: colors.primary,
    },
    signOutLink: { marginTop: spacing[6] },
    signOutText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textTertiary,
      textDecorationLine: 'underline',
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/lock.tsx
git commit -m "feat: add lock screen with PIN pad and biometric unlock"
```

---

## Task 10: Create app/(modals)/pin-setup.tsx

**Files:**
- Create: `app/(modals)/pin-setup.tsx`

- [ ] **Step 1: Create app/(modals)/pin-setup.tsx**

```tsx
import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Vibration, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { useTheme } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

type Step = 'enter' | 'confirm';

export default function PinSetupModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateSecuritySetting } = useProfileStore();
  const [step, setStep] = useState<Step>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleDigit(digit: string) {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      if (step === 'enter') {
        setFirstPin(newPin);
        setPin('');
        setStep('confirm');
        setError(null);
      } else {
        if (newPin === firstPin) {
          const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            newPin,
          );
          await SecureStore.setItemAsync('gocheck_pin_hash', hash);
          await updateSecuritySetting('pinEnabled', true);
          router.back();
        } else {
          Vibration.vibrate(300);
          setError('PINs do not match. Try again.');
          setPin('');
          setFirstPin('');
          setStep('enter');
        }
      }
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1));
  }

  function handleCancel() {
    Alert.alert('Cancel PIN Setup', 'PIN will not be saved.', [
      { text: 'Continue Setup', style: 'cancel' },
      { text: 'Cancel', style: 'destructive', onPress: () => router.back() },
    ]);
  }

  const numpad = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'del'],
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[3], paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Set PIN</Text>
        <View style={{ width: 56 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.stepTitle}>
          {step === 'enter' ? 'Choose a 4-digit PIN' : 'Confirm your PIN'}
        </Text>
        <Text style={styles.stepSubtitle}>
          {step === 'enter'
            ? 'You will use this to unlock GoCheck'
            : 'Enter the same PIN again to confirm'}
        </Text>

        {/* Step indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>

        {/* PIN dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
          ))}
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Numpad */}
        <View style={styles.numpad}>
          {numpad.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key, ki) => {
                if (key === '') return <View key={ki} style={styles.numpadEmpty} />;
                if (key === 'del') {
                  return (
                    <TouchableOpacity key={ki} style={styles.numpadKey} onPress={handleDelete} activeOpacity={0.6}>
                      <Feather name="delete" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                }
                return (
                  <TouchableOpacity
                    key={ki}
                    style={styles.numpadKey}
                    onPress={() => handleDigit(key)}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.numpadKeyText}>{key}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing[5], paddingBottom: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    cancelText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: colors.primary },
    headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
    content: { flex: 1, alignItems: 'center', paddingTop: spacing[10] },
    stepTitle: { fontFamily: typography.sansBold, fontSize: fontSize.xl, color: colors.textPrimary, marginBottom: spacing[1] },
    stepSubtitle: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing[5] },
    stepIndicator: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[8] },
    stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
    stepDotActive: { backgroundColor: colors.primary },
    dotsRow: { flexDirection: 'row', gap: spacing[4], marginBottom: spacing[3] },
    dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
    dotFilled: { backgroundColor: colors.primary, borderColor: colors.primary },
    errorBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
      backgroundColor: colors.errorSurface, borderRadius: radius.md,
      paddingHorizontal: spacing[3], paddingVertical: spacing[2], marginBottom: spacing[4],
    },
    errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.error },
    numpad: { width: '100%', maxWidth: 280, marginTop: spacing[5] },
    numpadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing[3] },
    numpadEmpty: { width: 72, height: 72 },
    numpadKey: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colors.border,
    },
    numpadKeyText: { fontFamily: typography.sansMedium, fontSize: fontSize.xl, color: colors.textPrimary },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(modals\)/pin-setup.tsx
git commit -m "feat: add PIN setup modal with 2-step confirmation and SHA-256 hashing"
```

---

## Task 11: Create app/(modals)/auto-lock-settings.tsx

**Files:**
- Create: `app/(modals)/auto-lock-settings.tsx`

- [ ] **Step 1: Create app/(modals)/auto-lock-settings.tsx**

```tsx
import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { AUTO_LOCK_OPTIONS } from '../../src/types';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

export default function AutoLockSettingsModal() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { security, updateSecuritySetting } = useProfileStore();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleSelect(value: number) {
    await updateSecuritySetting('autoLockDuration', value);
    router.back();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing[3], paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="x" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Auto-lock</Text>
        <View style={{ width: 22 }} />
      </View>

      <Text style={styles.description}>
        GoCheck will lock automatically after this period of inactivity.
      </Text>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {AUTO_LOCK_OPTIONS.map(option => {
          const isSelected = security.autoLockDuration === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => handleSelect(option.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>
                {option.label}
              </Text>
              {isSelected && (
                <Feather name="check" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: spacing[5], paddingBottom: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary },
    description: {
      fontFamily: typography.sansRegular, fontSize: fontSize.sm,
      color: colors.textSecondary, paddingHorizontal: spacing[5],
      paddingTop: spacing[4], paddingBottom: spacing[2], lineHeight: fontSize.sm * 1.6,
    },
    list: { flex: 1 },
    listContent: { paddingHorizontal: spacing[4], paddingTop: spacing[2] },
    row: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingVertical: spacing[4], paddingHorizontal: spacing[4],
      marginBottom: spacing[1], borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border,
    },
    rowSelected: {
      backgroundColor: colors.primarySurface,
      borderColor: colors.primaryBorder,
    },
    rowLabel: {
      fontFamily: typography.sansMedium, fontSize: fontSize.base,
      color: colors.textPrimary,
    },
    rowLabelSelected: { color: colors.primary },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(modals\)/auto-lock-settings.tsx
git commit -m "feat: add auto-lock settings modal"
```

---

## Task 12: Build profile.tsx — shell, header, and reusable row components

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Replace profile.tsx with the shell + header (no sections yet)**

```tsx
import { useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Image, TouchableOpacity,
  StyleSheet, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

// ─── Reusable Row Components ────────────────────────────────────────────────────

type Colors = ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors'];

function SectionHeader({ title, colors }: { title: string; colors: Colors }) {
  return (
    <Text style={{
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      paddingHorizontal: spacing[4],
      paddingTop: spacing[5],
      paddingBottom: spacing[2],
    }}>
      {title}
    </Text>
  );
}

function SettingsCard({ children, colors }: { children: React.ReactNode; colors: Colors }) {
  return (
    <View style={{
      marginHorizontal: spacing[4],
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    }}>
      {children}
    </View>
  );
}

function RowDivider({ colors }: { colors: Colors }) {
  return (
    <View style={{
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
      marginLeft: spacing[4] + 32 + spacing[3], // align after icon
    }} />
  );
}

export { SectionHeader, SettingsCard, RowDivider };
export type { Colors };
```

Wait — the components should all be in the same file to keep it simple. Let me provide the full profile.tsx in Task 13 and 14. For this task, just create the shell with header.

Replace `app/(tabs)/profile.tsx` with:

```tsx
import { useMemo } from 'react';
import {
  View, Text, ScrollView, Image, StyleSheet,
  TouchableOpacity, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeContext';
import { useProfileStore } from '../../src/store/profileStore';
import { typography, fontSize, spacing, radius } from '../../src/theme/tokens';

// SECTIONS WILL BE ADDED IN TASKS 13 AND 14

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useProfileStore();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const avatarChar = (profile?.displayName ?? 'U')[0].toUpperCase();

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Nav header */}
      <View style={styles.navHeader}>
        <Text style={styles.navTitle}>Profile</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing[8] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarChar}>{avatarChar}</Text>
            </View>
          )}
          <Text style={styles.displayName}>{profile?.displayName ?? 'Loading...'}</Text>
          <Text style={styles.emailText}>
            Organizer · {profile?.id ? 'Connected' : '—'}
          </Text>
        </View>

        {/* Sections will be added in Tasks 13 & 14 */}

        {/* Sign out */}
        <View style={{ paddingHorizontal: spacing[4], marginTop: spacing[6] }}>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.8}>
            <Feather name="log-out" size={16} color={colors.error} />
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors']) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    navHeader: {
      paddingHorizontal: spacing[5],
      paddingVertical: spacing[5],
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    navTitle: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.xl,
      color: colors.textPrimary,
    },
    scroll: { flex: 1 },
    scrollContent: {},
    avatarSection: {
      alignItems: 'center',
      paddingTop: spacing[8],
      paddingBottom: spacing[6],
    },
    avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: spacing[3] },
    avatarFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    avatarChar: { fontFamily: typography.sansBold, fontSize: fontSize['3xl'], color: '#FFF' },
    displayName: {
      fontFamily: typography.sansBold,
      fontSize: fontSize.lg,
      color: colors.textPrimary,
      marginBottom: spacing[0.5],
    },
    emailText: {
      fontFamily: typography.sansRegular,
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    signOutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing[2],
      paddingVertical: spacing[4],
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: colors.error,
      backgroundColor: colors.errorSurface,
    },
    signOutText: {
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.base,
      color: colors.error,
    },
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "feat: profile screen shell with header, avatar, and sign-out button"
```

---

## Task 13: Profile screen — Security + Notifications sections

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Add reusable row components and Security + Notifications sections**

Add the following helper components and hooks at the top of `app/(tabs)/profile.tsx` (after imports, before `ProfileScreen`):

```tsx
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { autoLockLabel } from '../../src/types';

// ─── Reusable Components ──────────────────────────────────────────────────────

type ThemeColors = ReturnType<typeof import('../../src/theme/ThemeContext').useTheme>['colors'];

function SectionHeader({ title, colors }: { title: string; colors: ThemeColors }) {
  return (
    <Text style={{
      fontFamily: typography.sansSemiBold,
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
      paddingHorizontal: spacing[5],
      paddingTop: spacing[5],
      paddingBottom: spacing[2],
    }}>{title}</Text>
  );
}

function SettingsCard({ children, colors }: { children: React.ReactNode; colors: ThemeColors }) {
  return (
    <View style={{
      marginHorizontal: spacing[4],
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden' as const,
    }}>{children}</View>
  );
}

interface ToggleRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: ThemeColors;
  badgeText?: string;
  badgeColor?: string;
  disabled?: boolean;
  divider?: boolean;
}

function ToggleRow({
  icon, label, subtitle, value, onValueChange, colors,
  badgeText, badgeColor, disabled, divider = true,
}: ToggleRowProps) {
  return (
    <>
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: spacing[4], paddingVertical: spacing[3.5],
      }}>
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: colors.iconSurface,
          alignItems: 'center', justifyContent: 'center',
          marginRight: spacing[3],
        }}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
            <Text style={{ fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary }}>
              {label}
            </Text>
            {badgeText ? (
              <View style={{
                paddingHorizontal: spacing[2], paddingVertical: 2,
                backgroundColor: badgeColor ?? colors.successSurface,
                borderRadius: radius.sm,
              }}>
                <Text style={{ fontFamily: typography.sansSemiBold, fontSize: fontSize['2xs'], color: colors.success }}>
                  {badgeText}
                </Text>
              </View>
            ) : null}
          </View>
          {subtitle ? (
            <Text style={{ fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <Switch
          value={value}
          onValueChange={disabled ? undefined : onValueChange}
          trackColor={{ false: colors.surfaceHighlight, true: colors.primary }}
          thumbColor={colors.white}
          ios_backgroundColor={colors.surfaceHighlight}
          disabled={disabled}
        />
      </View>
      {divider && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing[4] + 34 + spacing[3] }} />}
    </>
  );
}

interface ChevronRowProps {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  subtitle?: string;
  value?: string;
  onPress: () => void;
  colors: ThemeColors;
  divider?: boolean;
}

function ChevronRow({ icon, label, subtitle, value, onPress, colors, divider = true }: ChevronRowProps) {
  return (
    <>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3.5] }}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: colors.iconSurface,
          alignItems: 'center', justifyContent: 'center',
          marginRight: spacing[3],
        }}>
          <Feather name={icon} size={16} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary }}>{label}</Text>
          {subtitle ? (
            <Text style={{ fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 1 }}>{subtitle}</Text>
          ) : null}
        </View>
        {value ? (
          <Text style={{ fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing[2] }}>{value}</Text>
        ) : null}
        <Feather name="chevron-right" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
      {divider && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: spacing[4] + 34 + spacing[3] }} />}
    </>
  );
}
```

Then replace the `{/* Sections will be added in Tasks 13 & 14 */}` comment inside `ScrollView` with:

```tsx
{/* SECURITY */}
<SectionHeader title="Security" colors={colors} />
<SettingsCard colors={colors}>
  <ToggleRow
    icon="activity"
    label="Biometric unlock"
    subtitle="Face ID / Touch ID on launch"
    value={security.biometricEnabled}
    colors={colors}
    onValueChange={async (val) => {
      if (val) {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!compatible || !enrolled) {
          Alert.alert('Not Available', 'Biometric authentication is not set up on this device.');
          return;
        }
        const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable biometric unlock' });
        if (!result.success) return;
      }
      await updateSecuritySetting('biometricEnabled', val);
    }}
  />
  <ToggleRow
    icon="lock"
    label="PIN code"
    subtitle={security.pinEnabled ? '4-digit PIN set' : 'Tap to set up a PIN'}
    value={security.pinEnabled}
    badgeText={security.pinEnabled ? 'Active' : undefined}
    colors={colors}
    onValueChange={async (val) => {
      if (val) {
        router.push('/(modals)/pin-setup');
      } else {
        Alert.alert('Remove PIN', 'Are you sure you want to remove your PIN?', [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove', style: 'destructive', onPress: async () => {
              await SecureStore.deleteItemAsync('gocheck_pin_hash');
              await updateSecuritySetting('pinEnabled', false);
            },
          },
        ]);
      }
    }}
  />
  <ChevronRow
    icon="clock"
    label="Auto-lock"
    subtitle={autoLockLabel(security.autoLockDuration)}
    onPress={() => router.push('/(modals)/auto-lock-settings')}
    colors={colors}
    divider={false}
  />
</SettingsCard>

{/* NOTIFICATIONS */}
<SectionHeader title="Notifications" colors={colors} />
<SettingsCard colors={colors}>
  <ToggleRow
    icon="bell"
    label="Push notifications"
    value={profile?.notifPush ?? true}
    colors={colors}
    onValueChange={async (val) => {
      if (val) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Enable notifications in your device settings.');
          return;
        }
      }
      await updateProfile({ notifPush: val });
    }}
  />
  <ToggleRow
    icon="mail"
    label="Email alerts"
    value={profile?.notifEmail ?? true}
    colors={colors}
    onValueChange={(val) => updateProfile({ notifEmail: val })}
  />
  <ToggleRow
    icon="message-circle"
    label="WhatsApp linked"
    subtitle="Send reminders via WhatsApp"
    value={profile?.notifWhatsapp ?? false}
    colors={colors}
    onValueChange={(val) => updateProfile({ notifWhatsapp: val })}
  />
  <ToggleRow
    icon="calendar"
    label="Due-soon alerts"
    subtitle="3 days before each bill is due"
    value={profile?.notifDueSoon ?? true}
    colors={colors}
    onValueChange={(val) => updateProfile({ notifDueSoon: val })}
  />
  <ToggleRow
    icon="alert-circle"
    label="Overdue alerts"
    value={profile?.notifOverdue ?? true}
    colors={colors}
    onValueChange={(val) => updateProfile({ notifOverdue: val })}
  />
  <ToggleRow
    icon="refresh-cw"
    label="Weekly digest"
    subtitle="Sundays at 6 PM"
    value={profile?.notifWeeklyDigest ?? false}
    colors={colors}
    onValueChange={(val) => updateProfile({ notifWeeklyDigest: val })}
    divider={false}
  />
</SettingsCard>
```

Also destructure `security`, `updateProfile`, and `updateSecuritySetting` from `useProfileStore()` in the `ProfileScreen` component:

```tsx
const { profile, security, signOut, updateProfile, updateSecuritySetting } = useProfileStore();
```

Add the missing imports at the top:

```tsx
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { autoLockLabel } from '../../src/types';
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "feat: add Security and Notifications sections to profile screen"
```

---

## Task 14: Profile screen — Payment Methods, Bills, Connectivity, Sign Out polish

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Add remaining sections after Notifications section**

After the Notifications `<SettingsCard>` closing tag, add:

```tsx
{/* PAYMENT METHODS */}
<SectionHeader title="Payment Methods" colors={colors} />
<SettingsCard colors={colors}>
  {(
    [
      { key: 'upi_hdfc' as const, icon: 'smartphone' as const, label: 'UPI · HDFC', sub: 'rahul@okhdfс' },
      { key: 'card_stripe' as const, icon: 'credit-card' as const, label: 'Card via Stripe', sub: 'Visa ending 4242' },
      { key: 'paypal' as const, icon: 'dollar-sign' as const, label: 'PayPal', sub: 'paypal.me/user' },
      { key: 'bank_transfer' as const, icon: 'server' as const, label: 'Bank Transfer', sub: 'Direct bank transfer' },
    ] as const
  ).map((method, idx, arr) => (
    <ToggleRow
      key={method.key}
      icon={method.icon}
      label={method.label}
      subtitle={method.sub}
      value={(profile?.paymentMethods ?? []).includes(method.key)}
      colors={colors}
      divider={idx < arr.length - 1}
      onValueChange={(val) => {
        const current = profile?.paymentMethods ?? [];
        const next = val
          ? [...current, method.key]
          : current.filter(k => k !== method.key);
        updateProfile({ paymentMethods: next });
      }}
    />
  ))}
</SettingsCard>

{/* BILLS */}
<SectionHeader title="Bills" colors={colors} />
<SettingsCard colors={colors}>
  <ChevronRow
    icon="repeat"
    label="Recurring bills"
    subtitle="Manage active recurring bills"
    onPress={() => router.push('/(modals)/reminders')}
    colors={colors}
  />
  <ChevronRow
    icon="globe"
    label="Default currency"
    value={`${profile?.defaultCurrency ?? 'MYR'}`}
    onPress={() => setCurrencySheetOpen(true)}
    colors={colors}
  />
  <ToggleRow
    icon="moon"
    label="Dark mode"
    value={isDark}
    colors={colors}
    divider={false}
    onValueChange={(val) => {
      toggleDark();
      updateProfile({ darkMode: val });
    }}
  />
</SettingsCard>

{/* CONNECTIVITY */}
<SectionHeader title="Connectivity" colors={colors} />
<SettingsCard colors={colors}>
  <ToggleRow
    icon="wifi-off"
    label="Offline mode"
    subtitle="Queue actions until back online"
    value={profile?.offlineMode ?? false}
    colors={colors}
    divider={false}
    onValueChange={(val) => updateProfile({ offlineMode: val })}
  />
</SettingsCard>
```

- [ ] **Step 2: Add currency picker bottom sheet**

Add this state at the top of `ProfileScreen`:

```tsx
const [currencySheetOpen, setCurrencySheetOpen] = useState(false);
```

And add the import:
```tsx
import { useState } from 'react';
import { Modal, FlatList } from 'react-native';
import { SUPPORTED_CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_LABELS, type Currency } from '../../src/types';
```

After the closing `</ScrollView>` tag (and before the outer `</View>`), add the currency picker modal:

```tsx
{/* Currency picker */}
<Modal
  visible={currencySheetOpen}
  transparent
  animationType="slide"
  onRequestClose={() => setCurrencySheetOpen(false)}
>
  <View style={styles.sheetOverlay}>
    <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
      <View style={styles.sheetHandle} />
      <Text style={styles.sheetTitle}>Default Currency</Text>
      <FlatList
        data={SUPPORTED_CURRENCIES}
        keyExtractor={c => c}
        renderItem={({ item }) => {
          const isSelected = (profile?.defaultCurrency ?? 'MYR') === item;
          return (
            <TouchableOpacity
              style={[styles.currencyRow, isSelected && { backgroundColor: colors.primarySurface }]}
              onPress={() => {
                updateProfile({ defaultCurrency: item });
                setCurrencySheetOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.currencyCode, isSelected && { color: colors.primary }]}>
                {item}
              </Text>
              <Text style={styles.currencyLabel}>{CURRENCY_LABELS[item]}</Text>
              <Text style={[styles.currencySymbol, isSelected && { color: colors.primary }]}>
                {CURRENCY_SYMBOLS[item]}
              </Text>
              {isSelected && <Feather name="check" size={16} color={colors.primary} />}
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity style={[styles.sheetCancel, { backgroundColor: colors.surface }]} onPress={() => setCurrencySheetOpen(false)}>
        <Text style={{ fontFamily: typography.sansMedium, fontSize: fontSize.base, color: colors.textPrimary }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

Add the sheet styles to `makeStyles`:

```tsx
sheetOverlay: {
  flex: 1, justifyContent: 'flex-end',
  backgroundColor: 'rgba(0,0,0,0.4)',
},
sheet: {
  borderTopLeftRadius: radius['2xl'],
  borderTopRightRadius: radius['2xl'],
  paddingTop: spacing[2],
  paddingBottom: spacing[6],
  maxHeight: '70%',
},
sheetHandle: {
  width: 36, height: 4, borderRadius: 2,
  backgroundColor: colors.border,
  alignSelf: 'center', marginBottom: spacing[4],
},
sheetTitle: {
  fontFamily: typography.sansBold, fontSize: fontSize.lg,
  color: colors.textPrimary,
  paddingHorizontal: spacing[5], marginBottom: spacing[3],
},
currencyRow: {
  flexDirection: 'row', alignItems: 'center', gap: spacing[3],
  paddingHorizontal: spacing[5], paddingVertical: spacing[3.5],
},
currencyCode: {
  fontFamily: typography.sansSemiBold, fontSize: fontSize.base,
  color: colors.textPrimary, width: 40,
},
currencyLabel: {
  fontFamily: typography.sansRegular, fontSize: fontSize.sm,
  color: colors.textSecondary, flex: 1,
},
currencySymbol: {
  fontFamily: typography.sansMedium, fontSize: fontSize.base,
  color: colors.textSecondary,
},
sheetCancel: {
  marginHorizontal: spacing[4], marginTop: spacing[3],
  paddingVertical: spacing[4], borderRadius: radius.lg,
  alignItems: 'center', borderWidth: 1, borderColor: colors.border,
},
```

Also destructure `isDark` and `toggleDark` from `useTheme()`:

```tsx
const { colors, isDark, toggleDark } = useTheme();
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/profile.tsx
git commit -m "feat: complete profile screen with all sections, currency picker, and dark mode toggle"
```

---

## Task 15: Final wiring and verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Run all tests**

```bash
npx jest --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Start the app and manually verify auth flow**

```bash
npx expo start --web
```

Verify:
- App redirects to `/auth/sign-in` when no session
- Google Sign-In button is visible and styled
- (Requires real device / Expo Go for full OAuth test)

- [ ] **Step 4: Manually verify Profile screen**

After signing in, navigate to Profile tab and confirm:
- Avatar and name load from Google account
- All 6 sections render (Security, Notifications, Payment Methods, Bills, Connectivity)
- All toggles are interactive
- Chevron rows navigate to correct modals
- Dark mode toggle switches the entire app color scheme
- Currency picker shows all currencies and saves selection

- [ ] **Step 5: Manually verify lock screen**

In Profile → Security → enable PIN code → set a 4-digit PIN → background the app and return → confirm lock screen appears with PIN pad.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete Profile, Auth, Security, and Dark Mode implementation"
```

---

## Post-implementation notes

- **Google OAuth redirect**: For Expo Go testing, the redirect URI is `exp://127.0.0.1:8081/--/auth/callback`. For production builds it is `gocheck://auth/callback`. Add both to your Supabase dashboard Redirect URLs.
- **Push notifications**: Full remote push (from server) requires registering the Expo push token. The current implementation handles permissions only. To send server-initiated pushes, store the token in `user_profiles` and send via Expo's push API.
- **Biometric on simulator/emulator**: `expo-local-authentication` returns `hasHardwareAsync: false` on simulators. Test biometric on a real device.
- **SecureStore keys**: `lock.tsx` and `pin-setup.tsx` import `SECURE_KEYS` from `profileStore` — add `import { SECURE_KEYS } from '../src/store/profileStore'` and replace hardcoded string `'gocheck_pin_hash'` with `SECURE_KEYS.pinHash` for consistency.
