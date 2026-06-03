# Share Flow Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken `gocheck.app` share domain with a working `go-check.vercel.app` URL, rebuild the `/share/{code}` landing page as a cosmic read-only group invoice that hands off to `/p/{token}` for payment, and add OpenGraph link previews so WhatsApp / Gmail unfurl the link with a branded card.

**Architecture:** Single env-var source of truth (`EXPO_PUBLIC_WEB_BASE_URL`) for both participant and bill URLs. The Supabase RPC `get_bill_by_share_link` is extended to return per-participant access tokens, organizer display name, and payment method so the new landing page can render a complete invoice and link unpaid participants to their personal `/p/{token}` payment flow. OG meta tags are injected client-side via a small helper and at build time via a post-build script for crawlers that don't execute JS.

**Tech Stack:** Expo Router, Supabase Postgres + Realtime, TypeScript, Reanimated, expo-linear-gradient, react-native-svg. Migration applied via `mcp__supabase__apply_migration`.

**Spec:** `docs/superpowers/specs/2026-06-03-share-flow-buttons-modal-fix-design.md` § Project A.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/011_share_link_rpc_extended_fields.sql` | Create | Extend `get_bill_by_share_link` RPC to return `access_token`, `payment_status` per participant + `payment_method`, `payment_details`, `invoice_number`, `organizer_display_name` on the bill. |
| `src/lib/supabase.ts` (`getBillByShareLink` return type) | Modify | Add the new fields to the inferred return type. |
| `src/lib/share.ts` | Modify | `getShareBase()` reads `EXPO_PUBLIC_WEB_BASE_URL` first, falls back to `Constants.expoConfig.extra.shareBaseUrl`, defaults to `https://go-check.vercel.app`. Returns base without `/share` suffix; `getBillShareUrl()` appends it. |
| `app.json` | Modify | `expo.extra.shareBaseUrl` → `https://go-check.vercel.app`. |
| `src/components/effects/BeamBackdrop.tsx` | Create | Extract the existing inline `BeamBackdrop` from `app/p/[token].tsx` into a reusable component so `/share/{code}` can use the same visual. |
| `app/p/[token].tsx` | Modify | Replace the inline `BeamBackdrop` function with an import from the new shared file. **No visual changes.** |
| `src/lib/ogTags.ts` | Create | `setOgTags({ title, description, image, url })` injects/updates `<meta>` tags on `document.head`. No-op on native. |
| `app/(modals)/share/[code].tsx` | Rewrite | Replace the existing plain page with a cosmic read-only group invoice. Read-only: no payment mutation. Realtime subscription for live progress. Calls `setOgTags` once `bill` loads. Each unpaid participant with an `access_token` gets a "This is me — pay my share" button that navigates to `/p/{accessToken}`. |
| `scripts/inject-og-tags.js` | Create | Post-build Node script that reads `dist/index.html` and injects default OG meta tags so any link previews before the JS bundle loads. |
| `package.json` | Modify | `build` script: chain `expo export -p web && node scripts/inject-og-tags.js`. |

---

## Task 1: Extend `get_bill_by_share_link` RPC

**Files:**
- Create: `supabase/migrations/011_share_link_rpc_extended_fields.sql`

The current RPC (defined in `006_rls_and_fk.sql:201-268`) returns enough for a simple paid/unpaid view but lacks the fields the new landing page needs: per-participant `access_token` and `payment_status` (to drive the "pay my share" handoff), bill `payment_method` / `payment_details` (display only — no editing), bill `invoice_number` (for header), and `organizer_display_name` (joined from `user_profiles`).

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/011_share_link_rpc_extended_fields.sql`:

```sql
-- Migration 011: Extend get_bill_by_share_link RPC to surface fields the
-- new cosmic group invoice landing page needs.
--   * organizer_display_name (joined from user_profiles)
--   * bill: payment_method, payment_details, invoice_number
--   * participants: access_token, payment_status

CREATE OR REPLACE FUNCTION public.get_bill_by_share_link(p_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill_id UUID;
  v_result  json;
BEGIN
  SELECT bill_id INTO v_bill_id
  FROM share_links
  WHERE code = p_code
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now());

  IF v_bill_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT json_build_object(
    'id',                       b.id,
    'title',                    b.title,
    'description',              b.description,
    'total_amount',             b.total_amount,
    'currency',                 b.currency,
    'due_date',                 b.due_date,
    'status',                   b.status,
    'share_link',               b.share_link,
    'category',                 b.category,
    'is_recurring',             b.is_recurring,
    'group_photo_url',          b.group_photo_url,
    'split_type',               b.split_type,
    'tax_rate',                 b.tax_rate,
    'created_at',               b.created_at,
    'updated_at',               b.updated_at,
    'invoice_number',           b.invoice_number,
    'payment_method',           b.payment_method,
    'payment_details',          b.payment_details,
    'organizer_display_name',   COALESCE(up.display_name, 'Organizer'),
    'participants', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',             p.id,
        'name',           p.name,
        'email',          p.email,
        'phone',          p.phone,
        'amount',         p.amount,
        'is_paid',        p.is_paid,
        'paid_at',        p.paid_at,
        'avatar_color',   p.avatar_color,
        'shares',         p.shares,
        'percent',        p.percent,
        'access_token',   p.access_token,
        'payment_status', p.payment_status
      )), '[]'::json)
      FROM participants p WHERE p.bill_id = b.id
    ),
    'line_items', (
      SELECT COALESCE(json_agg(json_build_object(
        'id',          li.id,
        'description', li.description,
        'quantity',    li.quantity,
        'unit_price',  li.unit_price
      )), '[]'::json)
      FROM line_items li WHERE li.bill_id = b.id
    )
  ) INTO v_result
  FROM bills b
  LEFT JOIN user_profiles up ON up.id = b.organizer_id
  WHERE b.id = v_bill_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_bill_by_share_link(TEXT) TO anon, authenticated;
```

- [ ] **Step 2: Apply the migration to the Supabase project**

Use the Supabase MCP tool:

```
mcp__supabase__apply_migration(
  name="share_link_rpc_extended_fields",
  query="<contents of the file above>"
)
```

Expected: success response with no error.

- [ ] **Step 3: Verify the RPC returns the new fields**

Run this against the Supabase project (via `mcp__supabase__execute_sql`) using any existing active share code:

```sql
SELECT public.get_bill_by_share_link(
  (SELECT code FROM share_links WHERE is_active = true LIMIT 1)
);
```

Expected: JSON output containing `organizer_display_name`, `payment_method`, `invoice_number` on the bill, plus `access_token` and `payment_status` per participant. If no `share_links` row exists yet, create one manually first or skip this verification.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/011_share_link_rpc_extended_fields.sql
git commit -m "feat(db): extend get_bill_by_share_link with access_token, organizer, payment method"
```

---

## Task 2: Update `getBillByShareLink` TypeScript return type

**Files:**
- Modify: `src/lib/supabase.ts:112-142`

- [ ] **Step 1: Update the typed return**

Replace the `getBillByShareLink` function body's type cast (lines 112-142) with:

```ts
export async function getBillByShareLink(code: string) {
  const { data, error } = await supabase
    .rpc('get_bill_by_share_link', { p_code: code });
  if (error) throw error;
  if (!data) throw new Error('Bill not found');
  return data as {
    id: string;
    title: string;
    description: string | null;
    total_amount: number;
    currency: string;
    due_date: string;
    status: string;
    share_link: string;
    category: string | null;
    is_recurring: string | null;
    group_photo_url: string | null;
    split_type: string | null;
    tax_rate: number | null;
    created_at: string;
    updated_at: string;
    invoice_number: string | null;
    payment_method: string | null;
    payment_details: string | null;
    organizer_display_name: string;
    participants: Array<{
      id: string; name: string; email: string | null; phone: string | null;
      amount: number; is_paid: boolean; paid_at: string | null;
      avatar_color: string; shares: number | null; percent: number | null;
      access_token: string | null;
      payment_status: 'unpaid' | 'pending' | 'confirmed' | 'rejected';
    }>;
    line_items: Array<{
      id: string; description: string; quantity: number; unit_price: number;
    }>;
  };
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0 — no callers of `getBillByShareLink` break. The only existing caller is `app/(modals)/share/[code].tsx` which is rewritten in a later task.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "types: extend getBillByShareLink return to match RPC"
```

---

## Task 3: Update `share.ts` to use env-var driven base URL

**Files:**
- Modify: `src/lib/share.ts:6-14`

- [ ] **Step 1: Rewrite `getShareBase()` and `getBillShareUrl()`**

Replace lines 6-14 of `src/lib/share.ts` with:

```ts
function getShareBase(): string {
  // Single source of truth across all share URLs (participant + bill).
  // Priority: env var → app.json expoConfig.extra → hardcoded production default.
  const envBase = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  const configured = Constants.expoConfig?.extra?.shareBaseUrl as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');

  return 'https://go-check.vercel.app';
}

export function getBillShareUrl(shareLink: string): string {
  return `${getShareBase()}/share/${shareLink}`;
}
```

(`Constants` is already imported at the top of the file. The return value of `getShareBase` no longer includes `/share` — that suffix is added by `getBillShareUrl`.)

- [ ] **Step 2: Update `src/lib/urls.ts` to use the same helper**

Currently `src/lib/urls.ts` has its own duplicate of base-URL resolution. Replace the entire file with:

```ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';

function getBaseUrl(): string {
  const envBase = process.env.EXPO_PUBLIC_WEB_BASE_URL;
  if (envBase) return envBase.replace(/\/+$/, '');

  const configured = Constants.expoConfig?.extra?.shareBaseUrl as string | undefined;
  if (configured) return configured.replace(/\/+$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://go-check.vercel.app';
}

export function participantUrl(token: string): string {
  return `${getBaseUrl()}/p/${token}`;
}
```

Both helpers now resolve the same base, so a custom-domain flip is one env-var change.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/lib/share.ts src/lib/urls.ts
git commit -m "fix(share): unify share URL base + default to working go-check.vercel.app"
```

---

## Task 4: Update `app.json` shareBaseUrl

**Files:**
- Modify: `app.json:61`

- [ ] **Step 1: Replace the broken default**

In `app.json`, find:

```json
"shareBaseUrl": "https://gocheck.app/share",
```

Replace with:

```json
"shareBaseUrl": "https://go-check.vercel.app",
```

(Removed the `/share` suffix — `getBillShareUrl` adds it now. Removed the unreachable `gocheck.app` domain.)

- [ ] **Step 2: Verify the change**

Run: `npm run typecheck`
Expected: exit code 0 (no TS impact, but verify the JSON parses cleanly).

- [ ] **Step 3: Commit**

```bash
git add app.json
git commit -m "fix(config): default shareBaseUrl to go-check.vercel.app (no DNS for gocheck.app)"
```

---

## Task 5: Extract `BeamBackdrop` to shared component

**Files:**
- Create: `src/components/effects/BeamBackdrop.tsx`
- Modify: `app/p/[token].tsx:63-166` (remove the inline component, add import)

The new `/share/{code}` page uses the exact same cosmic backdrop as `/p/{token}`. Extract once.

- [ ] **Step 1: Create the extracted component**

Create `src/components/effects/BeamBackdrop.tsx`:

```tsx
import { useEffect } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Cosmic animated backdrop used by participant + group share landing pages.
 * Renders a multi-stop indigo→cyan→emerald gradient base with three
 * curved bezier "beam" paths that sweep across the screen on a 9s loop.
 *
 * Extracted from the inline implementation in app/p/[token].tsx so the
 * group share landing page can reuse the same visual.
 */
export function BeamBackdrop() {
  const { width, height } = useWindowDimensions();
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0.55);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(0.95, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    return () => {
      cancelAnimation(sweep);
      cancelAnimation(pulse);
    };
  }, [pulse, sweep]);

  const svgW = Math.max(width, 390);
  const svgH = Math.max(height, 780);
  const pathA = `M -80 ${svgH * 0.18} C ${svgW * 0.18} ${svgH * 0.02}, ${svgW * 0.34} ${svgH * 0.44}, ${svgW + 90} ${svgH * 0.14}`;
  const pathB = `M -70 ${svgH * 0.54} C ${svgW * 0.2} ${svgH * 0.32}, ${svgW * 0.52} ${svgH * 0.76}, ${svgW + 80} ${svgH * 0.46}`;
  const pathC = `M ${svgW + 70} ${svgH * 0.82} C ${svgW * 0.72} ${svgH * 0.58}, ${svgW * 0.22} ${svgH * 0.96}, -80 ${svgH * 0.68}`;

  const beamAProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [980, -980]),
    opacity: pulse.value,
  }));
  const beamBProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [520, -1320]),
    opacity: interpolate(pulse.value, [0.55, 0.95], [0.35, 0.8]),
  }));
  const beamCProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(sweep.value, [0, 1], [1200, -760]),
    opacity: interpolate(pulse.value, [0.55, 0.95], [0.25, 0.68]),
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={['#070A16', '#11123A', '#061B2A', '#071512']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={svgW} height={svgH} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinearGradient id="beamSoft" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#38BDF8" stopOpacity="0" />
            <Stop offset="30%" stopColor="#6366F1" stopOpacity="0.28" />
            <Stop offset="62%" stopColor="#22C55E" stopOpacity="0.22" />
            <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
          </SvgLinearGradient>
          <SvgLinearGradient id="beamHot" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <Stop offset="38%" stopColor="#A5B4FC" stopOpacity="0.95" />
            <Stop offset="56%" stopColor="#67E8F9" stopOpacity="0.9" />
            <Stop offset="72%" stopColor="#86EFAC" stopOpacity="0.75" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        <Path d={pathA} stroke="url(#beamSoft)" strokeWidth={54} strokeLinecap="round" fill="none" />
        <Path d={pathB} stroke="url(#beamSoft)" strokeWidth={68} strokeLinecap="round" fill="none" opacity={0.7} />
        <Path d={pathC} stroke="url(#beamSoft)" strokeWidth={58} strokeLinecap="round" fill="none" opacity={0.5} />
        <AnimatedPath
          d={pathA}
          stroke="url(#beamHot)"
          strokeWidth={3}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="180 760"
          animatedProps={beamAProps}
        />
        <AnimatedPath
          d={pathB}
          stroke="url(#beamHot)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="150 820"
          animatedProps={beamBProps}
        />
        <AnimatedPath
          d={pathC}
          stroke="url(#beamHot)"
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
          strokeDasharray="130 780"
          animatedProps={beamCProps}
        />
      </Svg>
      <LinearGradient
        colors={['rgba(7,10,22,0.12)', 'rgba(7,10,22,0.42)', 'rgba(248,250,252,0.08)']}
        locations={[0, 0.58, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
```

- [ ] **Step 2: Update `app/p/[token].tsx` to use the shared component**

In `app/p/[token].tsx`:

1. Remove lines 63-166 (the entire inline `BeamBackdrop` function definition).
2. Remove the module-scope helper at line 30: `const AnimatedPath = Animated.createAnimatedComponent(Path);` — only used inside the deleted `BeamBackdrop`.
3. Remove now-unused imports. The participant page body still uses `LinearGradient` (amount panel, lines 303-308) and the entering animations `FadeIn`, `FadeInUp`. Keep those.

Concretely the import diff is:

| Import | Action |
|---|---|
| `LinearGradient` from `expo-linear-gradient` | Keep (used by amount panel) |
| `Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path }` from `react-native-svg` | Remove entirely (only used in BeamBackdrop) |
| `useWindowDimensions` from `react-native` | Remove |
| From `react-native-reanimated`: `Animated, FadeIn, FadeInUp` | Keep |
| From `react-native-reanimated`: `cancelAnimation, Easing, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withTiming` | Remove (none used outside BeamBackdrop) |

If `npm run typecheck` after the edit shows a "noUnusedLocals" or related complaint for any import you kept, remove it too.

4. Add a new import near the other component imports:

```tsx
import { BeamBackdrop } from '../../src/components/effects/BeamBackdrop';
```

5. The two existing call sites `<BeamBackdrop />` (currently lines 227 and 236 — verify after deletion) reference the inline component. After removing the inline function, these call sites resolve to the new imported component automatically.

- [ ] **Step 3: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0. If unused-import errors appear, remove the listed imports.

- [ ] **Step 4: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 5: Manual web verification — participant page unchanged**

Run: `npm run dev`
- Open any active participant link `/p/{token}` (use a real token from the database via `mcp__supabase__execute_sql "SELECT access_token FROM participants WHERE access_token IS NOT NULL LIMIT 1"`)
- Confirm the cosmic backdrop renders exactly as before — beams sweep, gradient base shows, no visual regression

- [ ] **Step 6: Commit**

```bash
git add src/components/effects/BeamBackdrop.tsx app/p/[token].tsx
git commit -m "refactor(effects): extract BeamBackdrop component for reuse by group share page"
```

---

## Task 6: Create `setOgTags` helper

**Files:**
- Create: `src/lib/ogTags.ts`

- [ ] **Step 1: Write the helper**

Create `src/lib/ogTags.ts`:

```ts
import { Platform } from 'react-native';

interface OgTagOptions {
  title: string;
  description: string;
  image?: string;
  url?: string;
}

const MANAGED_FLAG = 'data-og-managed';

/**
 * Inject or update OpenGraph + Twitter Card meta tags on the document head.
 * Web-only — no-op on native.
 *
 * Tags managed by this helper are marked with `data-og-managed="true"` so
 * subsequent calls update existing tags in place instead of duplicating.
 *
 * This complements the static OG tags injected at build time by
 * scripts/inject-og-tags.js: the build script ensures a baseline preview
 * exists even before the JS bundle loads; this helper layers per-page
 * specifics on top once the bundle executes.
 */
export function setOgTags({ title, description, image, url }: OgTagOptions): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  setTag('property', 'og:title', title);
  setTag('property', 'og:description', description);
  setTag('property', 'og:type', 'website');
  if (image) setTag('property', 'og:image', image);
  if (url) setTag('property', 'og:url', url);

  setTag('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
  setTag('name', 'twitter:title', title);
  setTag('name', 'twitter:description', description);
  if (image) setTag('name', 'twitter:image', image);

  // Also update the document <title> so the browser tab reflects the page.
  document.title = title;
}

function setTag(attrName: 'property' | 'name', attrValue: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"][${MANAGED_FLAG}]`
  );
  if (!el) {
    // If an unmanaged tag exists (e.g., from the build-time injector),
    // replace it rather than duplicating.
    const existing = document.head.querySelector<HTMLMetaElement>(
      `meta[${attrName}="${attrValue}"]`
    );
    if (existing) {
      existing.setAttribute(MANAGED_FLAG, 'true');
      existing.setAttribute('content', content);
      return;
    }
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    el.setAttribute(MANAGED_FLAG, 'true');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/ogTags.ts
git commit -m "feat(og): add setOgTags helper for client-side OpenGraph meta tag injection"
```

---

## Task 7: Rewrite `/share/{code}` as cosmic read-only group invoice

**Files:**
- Rewrite: `app/(modals)/share/[code].tsx`

This is the largest task. The page is rewritten end-to-end. The new design mirrors `/p/{token}` for visual continuity but is **read-only** and delegates payment to the per-participant flow.

- [ ] **Step 1: Replace the file contents**

Replace the entire contents of `app/(modals)/share/[code].tsx` with:

```tsx
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { getBillByShareLink, supabase } from '../../../src/lib/supabase';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../../src/theme/tokens';
import type { Currency, PaymentFlowStatus } from '../../../src/types';
import { CURRENCY_SYMBOLS } from '../../../src/types';
import { AppText } from '../../../src/components/AppText';
import { BeamBackdrop } from '../../../src/components/effects/BeamBackdrop';
import { ColourfulText } from '../../../src/components/effects/ColourfulText';
import { participantUrl } from '../../../src/lib/urls';
import { setOgTags } from '../../../src/lib/ogTags';

interface BillData {
  id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: Currency;
  due_date: string;
  status: string;
  share_link: string;
  invoice_number: string | null;
  payment_method: string | null;
  payment_details: string | null;
  organizer_display_name: string;
  participants: Array<{
    id: string;
    name: string;
    amount: number;
    is_paid: boolean;
    paid_at: string | null;
    avatar_color: string;
    access_token: string | null;
    payment_status: PaymentFlowStatus;
  }>;
}

const paymentMethodLabel: Record<string, string> = {
  duitnow: 'DuitNow',
  bank_transfer: 'Bank transfer',
  ewallet: 'eWallet / TNG',
  cash: 'Cash',
};

function readableDate(value?: string, pattern = 'd MMM yyyy'): string {
  if (!value) return 'Not set';
  return format(new Date(value), pattern);
}

function statusTone(status: PaymentFlowStatus) {
  if (status === 'pending') return { bg: '#FFF7ED', fg: '#B45309', icon: 'clock' as const, label: 'Under review' };
  if (status === 'confirmed') return { bg: '#ECFDF5', fg: '#059669', icon: 'check-circle' as const, label: 'Paid' };
  if (status === 'rejected') return { bg: '#FEF2F2', fg: '#DC2626', icon: 'alert-circle' as const, label: 'Needs resubmission' };
  return { bg: '#EEF2FF', fg: colors.primary, icon: 'credit-card' as const, label: 'Unpaid' };
}

export default function ShareBillScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const insets = useSafeAreaInsets();
  const [bill, setBill] = useState<BillData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!code) return;
    setError(null);
    setLoading(true);
    try {
      const data = await getBillByShareLink(code);
      setBill(data as BillData);
    } catch {
      setError('Bill not found or link is invalid.');
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  // Realtime: when any participant of this bill changes, refresh.
  useEffect(() => {
    if (!bill?.id) return;
    const channel = supabase
      .channel(`group-share:${bill.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'participants',
        filter: `bill_id=eq.${bill.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bill?.id, load]);

  // OpenGraph tags for link previews (web only).
  useEffect(() => {
    if (!bill || Platform.OS !== 'web') return;
    const symbol = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
    const paidCount = bill.participants.filter((p) => p.payment_status === 'confirmed').length;
    const totalCount = bill.participants.length;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    setOgTags({
      title: `${bill.title} — Split with ${bill.organizer_display_name} · GoCheck`,
      description: `${paidCount}/${totalCount} paid · ${symbol}${bill.total_amount.toFixed(2)} due ${readableDate(bill.due_date)}`,
      image: origin ? `${origin}/assets/og-banner.png` : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
    });
  }, [bill]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <BeamBackdrop />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !bill) {
    return (
      <View style={styles.centered}>
        <BeamBackdrop />
        <Feather name="alert-circle" size={48} color={colors.error} />
        <AppText style={styles.errorTitle}>Bill not found</AppText>
        <AppText style={styles.errorText}>{error ?? 'This link is no longer valid.'}</AppText>
        <Pressable style={styles.retry} onPress={() => router.back()}>
          <AppText style={styles.retryText}>Go back</AppText>
        </Pressable>
      </View>
    );
  }

  const symbol = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;
  const paidCount = bill.participants.filter((p) => p.payment_status === 'confirmed').length;
  const totalCount = bill.participants.length;
  const amountCollected = bill.participants
    .filter((p) => p.payment_status === 'confirmed')
    .reduce((sum, p) => sum + p.amount, 0);
  const percent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  function openParticipantPage(token: string) {
    const url = participantUrl(token);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = url;
    } else {
      router.push(`/p/${token}` as any);
    }
  }

  return (
    <View style={styles.root}>
      <BeamBackdrop />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + spacing[5], paddingBottom: insets.bottom + spacing[8] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.brand}>
          <View style={styles.brandLeft}>
            <Image source={require('../../../assets/logo.png')} style={styles.logo} />
            <View style={styles.brandTextBlock}>
              <ColourfulText
                text="GoCheck"
                style={styles.brandName}
                palette={['#FFFFFF', '#A5B4FC', '#67E8F9', '#86EFAC', '#FDE68A']}
                duration={3600}
                containerStyle={styles.brandNameRow}
              />
              <AppText style={styles.brandSub}>Group bill</AppText>
            </View>
          </View>
          <View style={styles.statusPill}>
            <Feather name="users" size={13} color={colors.primary} />
            <AppText style={styles.statusPillText} numberOfLines={1}>
              {totalCount} participant{totalCount === 1 ? '' : 's'}
            </AppText>
          </View>
        </Animated.View>

        {/* Invoice card */}
        <Animated.View entering={FadeInUp.delay(80).duration(350)} style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View style={styles.invoiceHeaderText}>
              <AppText style={styles.invoiceLabel}>BILL INVOICE</AppText>
              <AppText style={styles.invoiceTitle} numberOfLines={2}>{bill.title}</AppText>
              {bill.description ? (
                <AppText style={styles.invoiceDescription} numberOfLines={3}>{bill.description}</AppText>
              ) : null}
            </View>
            <View style={styles.invoiceNumberBlock}>
              <AppText style={styles.invoiceNumberLabel}>Invoice</AppText>
              <AppText style={styles.invoiceNumber} numberOfLines={1}>
                {bill.invoice_number ?? bill.share_link.slice(0, 8).toUpperCase()}
              </AppText>
            </View>
          </View>

          {/* Amount panel */}
          <LinearGradient
            colors={['#111827', '#312E81', '#0F766E']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.amountPanel}
          >
            <View style={styles.amountTopRow}>
              <AppText style={styles.amountLabel}>Total amount</AppText>
              <AppText style={styles.amountDate}>{readableDate(bill.due_date)}</AppText>
            </View>
            <AppText style={styles.amount}>{symbol}{bill.total_amount.toFixed(2)}</AppText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <View style={styles.progressMeta}>
              <AppText style={styles.progressMetaText}>
                {symbol}{amountCollected.toFixed(2)} collected
              </AppText>
              <AppText style={styles.progressMetaText}>{percent}%</AppText>
            </View>
          </LinearGradient>

          {/* Meta grid */}
          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Organizer</AppText>
              <AppText style={styles.metaValue} numberOfLines={1}>{bill.organizer_display_name}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Due date</AppText>
              <AppText style={styles.metaValue}>{readableDate(bill.due_date)}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Currency</AppText>
              <AppText style={styles.metaValue}>{bill.currency}</AppText>
            </View>
            <View style={styles.metaItem}>
              <AppText style={styles.metaLabel}>Progress</AppText>
              <AppText style={styles.metaValue}>{paidCount}/{totalCount} paid</AppText>
            </View>
          </View>

          {/* Payment method (display-only) */}
          {(bill.payment_method || bill.payment_details) ? (
            <>
              <View style={styles.divider} />
              <View style={styles.paymentHeader}>
                <View style={styles.paymentIcon}>
                  <Feather name="credit-card" size={16} color={colors.primary} />
                </View>
                <View style={styles.paymentHeaderText}>
                  <AppText style={styles.sectionLabel}>Payment method</AppText>
                  {bill.payment_method ? (
                    <AppText style={styles.paymentMethod}>
                      {paymentMethodLabel[bill.payment_method] ?? bill.payment_method}
                    </AppText>
                  ) : null}
                </View>
              </View>
              {bill.payment_details ? (
                <AppText style={styles.paymentDetails}>{bill.payment_details}</AppText>
              ) : null}
            </>
          ) : null}
        </Animated.View>

        {/* Participants list */}
        <Animated.View entering={FadeInUp.delay(160).duration(350)} style={styles.participantsCard}>
          <AppText style={styles.participantsTitle}>Participants</AppText>
          {bill.participants.map((p) => {
            const tone = statusTone(p.payment_status);
            const isPaidLike = p.payment_status === 'confirmed' || p.payment_status === 'pending';
            return (
              <View key={p.id} style={styles.participantRow}>
                <View style={[styles.avatar, { backgroundColor: p.avatar_color }]}>
                  <AppText style={styles.avatarText}>{p.name.slice(0, 1).toUpperCase()}</AppText>
                  {p.payment_status === 'confirmed' ? (
                    <View style={styles.avatarPaidBadge}>
                      <Feather name="check" size={9} color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <View style={styles.participantInfo}>
                  <AppText style={styles.participantName} numberOfLines={1}>{p.name}</AppText>
                  <AppText style={styles.participantAmount}>{symbol}{p.amount.toFixed(2)}</AppText>
                </View>
                <View style={styles.participantRight}>
                  <View style={[styles.toneChip, { backgroundColor: tone.bg }]}>
                    <Feather name={tone.icon} size={11} color={tone.fg} />
                    <AppText style={[styles.toneChipText, { color: tone.fg }]}>{tone.label}</AppText>
                  </View>
                  {!isPaidLike && p.access_token ? (
                    <Pressable
                      style={({ pressed }) => [styles.payMyShareBtn, pressed && { opacity: 0.85 }]}
                      onPress={() => openParticipantPage(p.access_token!)}
                      accessibilityRole="button"
                      accessibilityLabel={`Pay my share as ${p.name}`}
                    >
                      <Feather name="arrow-right" size={12} color={colors.white} />
                      <AppText style={styles.payMyShareText}>This is me — pay</AppText>
                    </Pressable>
                  ) : !isPaidLike ? (
                    <AppText style={styles.noLinkHint}>Ask organizer for your link</AppText>
                  ) : null}
                </View>
              </View>
            );
          })}
        </Animated.View>

        <AppText style={styles.footer}>Secure record by GoCheck</AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#070A16' },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[4], width: '100%', maxWidth: 460, alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6], backgroundColor: '#070A16' },
  errorTitle: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: '#FFFFFF' },
  errorText: { fontFamily: typography.sansRegular, fontSize: fontSize.base, color: 'rgba(255,255,255,0.72)', textAlign: 'center' },
  retry: { backgroundColor: colors.primary, borderRadius: radius.xl, paddingHorizontal: spacing[6], paddingVertical: spacing[3] },
  retryText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, color: '#FFF' },

  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1, minWidth: 0 },
  logo: { width: 38, height: 38, borderRadius: 19 },
  brandTextBlock: { flex: 1, minWidth: 0 },
  brandNameRow: { alignSelf: 'flex-start' },
  brandName: { fontFamily: typography.sansBold, fontSize: fontSize.lg },
  brandSub: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.68)' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: '#EEF2FF',
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: spacing[1.5],
    maxWidth: 180,
  },
  statusPillText: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: colors.primary, flexShrink: 1 },

  invoiceCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    padding: spacing[4],
    gap: spacing[4],
    ...shadow.md,
  },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[3] },
  invoiceHeaderText: { flex: 1, minWidth: 0 },
  invoiceLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.primary, letterSpacing: 1 },
  invoiceTitle: { fontFamily: typography.sansBold, fontSize: fontSize.xl, color: colors.textPrimary, marginTop: spacing[1] },
  invoiceDescription: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, color: colors.textSecondary, lineHeight: fontSize.sm * 1.45, marginTop: spacing[1] },
  invoiceNumberBlock: { alignItems: 'flex-end', maxWidth: 124, paddingTop: spacing[0.5] },
  invoiceNumberLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  invoiceNumber: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: colors.textPrimary, marginTop: 2 },

  amountPanel: { borderRadius: radius.xl, padding: spacing[4], overflow: 'hidden', gap: spacing[2] },
  amountTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing[2] },
  amountLabel: { fontFamily: typography.sansBold, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase' },
  amountDate: { fontFamily: typography.monoMedium, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.76)' },
  amount: { fontFamily: typography.sansBold, fontSize: fontSize['4xl'], color: '#FFFFFF', marginTop: spacing[1] },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, overflow: 'hidden', marginTop: spacing[2] },
  progressFill: { height: '100%', backgroundColor: '#86EFAC', borderRadius: radius.full },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[1] },
  progressMetaText: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: 'rgba(255,255,255,0.85)' },

  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  metaItem: {
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
    padding: spacing[3],
    gap: spacing[1],
  },
  metaLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  metaValue: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.textPrimary },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  paymentHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  paymentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primarySurface, alignItems: 'center', justifyContent: 'center' },
  paymentHeaderText: { flex: 1, minWidth: 0 },
  sectionLabel: { fontFamily: typography.sansBold, fontSize: 10, color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  paymentMethod: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary, marginTop: 2 },
  paymentDetails: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: fontSize.sm * 1.55,
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing[3],
  },

  participantsCard: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: radius['2xl'],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.84)',
    padding: spacing[4],
    gap: spacing[2],
    ...shadow.md,
  },
  participantsTitle: { fontFamily: typography.sansBold, fontSize: fontSize.base, color: colors.textPrimary, marginBottom: spacing[1] },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2.5],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  avatar: { width: 38, height: 38, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: typography.sansBold, fontSize: 15, color: colors.white },
  avatarPaidBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  participantInfo: { flex: 1, minWidth: 0 },
  participantName: { fontFamily: typography.sansSemiBold, fontSize: fontSize.sm, color: colors.textPrimary },
  participantAmount: { fontFamily: typography.monoMedium, fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  participantRight: { alignItems: 'flex-end', gap: spacing[1.5], maxWidth: 160 },
  toneChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3 },
  toneChipText: { fontFamily: typography.sansBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  payMyShareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing[2.5], paddingVertical: 5,
    borderRadius: radius.full,
  },
  payMyShareText: { fontFamily: typography.sansSemiBold, fontSize: 11, color: colors.white },
  noLinkHint: { fontFamily: typography.sansRegular, fontSize: 10, color: colors.textSecondary, textAlign: 'right', maxWidth: 140 },

  footer: { fontFamily: typography.sansRegular, fontSize: fontSize.xs, color: colors.textSecondary, textAlign: 'center', marginTop: spacing[4] },
});
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: exit code 0

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Manual web verification**

Run: `npm run dev`
- Get a valid share code: `mcp__supabase__execute_sql "SELECT code FROM share_links WHERE is_active = true LIMIT 1"`
- Open `http://localhost:8081/share/<code>` in browser
- Confirm: cosmic backdrop renders, brand header shows GoCheck logo + colourful text, invoice card with title/amount/progress bar shows correctly, participants list shows tone chips per status, unpaid participants with `access_token` show a "This is me — pay" button
- Click "This is me — pay" → navigates to `/p/{token}`
- Confirm OG tags exist: open DevTools → Elements → look in `<head>` for `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:image">` with `data-og-managed="true"`
- Confirm document title updated to bill title

- [ ] **Step 5: Realtime check**

With the share page open in one window, in another tab/device confirm the bill via `/p/{token}` for one participant. Within ~2 seconds the share page should refresh and show that participant as "Paid".

- [ ] **Step 6: Commit**

```bash
git add app/(modals)/share/[code].tsx
git commit -m "feat(share): rewrite /share/{code} as cosmic read-only group invoice with /p handoff"
```

---

## Task 8: Post-build OG injection script

**Files:**
- Create: `scripts/inject-og-tags.js`
- Modify: `package.json` `build` script

This guarantees a baseline OG preview exists even for crawlers that don't execute JS. For now, the `og:image` points to the existing `logo_v2.png` (already at `/assets/logo_v2.png` after build). A proper 1200×630 banner can be added later as a separate asset; the script will switch automatically once that file exists at `assets/og-banner.png`.

- [ ] **Step 1: Write the injection script**

Create `scripts/inject-og-tags.js`:

```js
#!/usr/bin/env node
/* eslint-disable */
// Post-build OG tag injector.
// Reads dist/index.html, ensures default OpenGraph + Twitter Card meta
// tags exist in the head. setOgTags() in src/lib/ogTags.ts replaces these
// with per-bill specifics once the JS bundle loads, but baseline tags
// ensure link previews work even for crawlers that don't execute JS.

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'dist', 'index.html');
const BANNER_PATH_NEW = '/assets/og-banner.png';
const BANNER_PATH_FALLBACK = '/assets/logo_v2.png';

const DEFAULT_TITLE = 'GoCheck — Split bills, settle smart';
const DEFAULT_DESCRIPTION = 'Track who paid, who hasn\'t, and remind in one tap. No accounts needed for participants.';
const DEFAULT_URL = process.env.EXPO_PUBLIC_WEB_BASE_URL || 'https://go-check.vercel.app';

if (!fs.existsSync(HTML_PATH)) {
  console.error(`[og] dist/index.html not found at ${HTML_PATH} — did expo export run?`);
  process.exit(1);
}

// Pick banner: prefer the dedicated 1200x630 if present, else the existing logo.
const distDir = path.dirname(HTML_PATH);
const bannerCandidate = path.join(distDir, 'assets', 'og-banner.png');
const image = `${DEFAULT_URL}${fs.existsSync(bannerCandidate) ? BANNER_PATH_NEW : BANNER_PATH_FALLBACK}`;

const tags = [
  `<meta property="og:title" content="${DEFAULT_TITLE}" />`,
  `<meta property="og:description" content="${DEFAULT_DESCRIPTION}" />`,
  `<meta property="og:type" content="website" />`,
  `<meta property="og:url" content="${DEFAULT_URL}" />`,
  `<meta property="og:image" content="${image}" />`,
  `<meta name="twitter:card" content="summary_large_image" />`,
  `<meta name="twitter:title" content="${DEFAULT_TITLE}" />`,
  `<meta name="twitter:description" content="${DEFAULT_DESCRIPTION}" />`,
  `<meta name="twitter:image" content="${image}" />`,
].join('\n    ');

let html = fs.readFileSync(HTML_PATH, 'utf8');

// Idempotent: strip any previously injected block before re-inserting.
html = html.replace(/<!-- og:start -->[\s\S]*?<!-- og:end -->\s*/g, '');

const injection = `<!-- og:start -->\n    ${tags}\n    <!-- og:end -->\n  `;

if (!/<\/head>/i.test(html)) {
  console.error('[og] No </head> tag found in dist/index.html — aborting.');
  process.exit(1);
}

html = html.replace(/<\/head>/i, `${injection}</head>`);
fs.writeFileSync(HTML_PATH, html, 'utf8');
console.log(`[og] Injected default OG tags into ${HTML_PATH} (image: ${image})`);
```

- [ ] **Step 2: Update `package.json` build script**

In `package.json`, find:

```json
"build": "expo export --platform web"
```

Replace with:

```json
"build": "expo export --platform web && node scripts/inject-og-tags.js"
```

- [ ] **Step 3: Test the build locally**

Run: `npm run build`
Expected:
- `expo export` completes successfully and writes to `dist/`
- The injection script logs `[og] Injected default OG tags into dist/index.html ...`
- Open `dist/index.html` in a text viewer and confirm the OG tags appear inside `<head>` between `<!-- og:start -->` and `<!-- og:end -->` markers

- [ ] **Step 4: Verify idempotency**

Run: `npm run build` a second time. The script should strip the previous block and re-inject — confirm `dist/index.html` only contains one `<!-- og:start -->` block.

- [ ] **Step 5: Commit**

```bash
git add scripts/inject-og-tags.js package.json
git commit -m "feat(build): inject default OpenGraph tags into dist/index.html post-build"
```

---

## Task 9: Final manual QA + deploy verification

**Files:** none modified

- [ ] **Step 1: Local web QA — group share landing page**

Run: `npm run dev`
- Sign in, create a bill with 2-3 participants
- From the bill detail screen, tap the share icon → copy the share message
- Confirm the URL in the share message is `https://go-check.vercel.app/share/<code>` (NOT `gocheck.app`)
- Paste the URL into the browser address bar → cosmic invoice page renders
- Confirm: progress bar reflects collection percentage, organizer name shows correctly, payment method panel shows if set, every participant has a status chip and (for unpaid) a "This is me — pay" button
- Click "This is me — pay" → navigates to `/p/{token}` (existing page, untouched)
- From `/p/{token}`, slide-to-confirm payment → back to share page → confirm the row updates within 2s via realtime

- [ ] **Step 2: Local web QA — WhatsApp-style preview**

The OG tags are client-side, so to preview a real WhatsApp unfurl you need a deployed URL. For local verification:

- Build production: `npm run build`
- Serve dist/: `npx serve dist -p 5000`
- Open `http://localhost:5000/share/<code>` in a browser
- View page source — confirm both the build-injected default OG tags AND the client-injected per-bill tags appear (per-bill tags will replace defaults via the `data-og-managed` flag once JS executes)

- [ ] **Step 3: Production deploy verification**

After deploying to Vercel:
- Use the [Meta sharing debugger](https://developers.facebook.com/tools/debug/) (or similar) to crawl `https://go-check.vercel.app/share/<code>`
- Confirm the preview shows the bill title, paid count, due date, and banner image
- Open the URL in WhatsApp Web → confirm the link card unfurls

- [ ] **Step 4: Native sanity check (if device available)**

If iOS/Android simulator/device set up:
- Open a fresh bill, share the link via the system share sheet
- Confirm the URL contains `go-check.vercel.app/share/...`
- Open the URL in mobile Safari/Chrome → confirm the new page renders on mobile web

- [ ] **Step 5: No commit (verification-only task)**

If QA exposes a regression, fix in a follow-up commit referencing the affected task.

---

## Notes for follow-up (out of scope of this plan)

- **Branded OG banner:** the build script currently falls back to `assets/logo_v2.png` because no `assets/og-banner.png` exists. Create a 1200×630 PNG with the cosmic theme + GoCheck logo + tagline and drop it at `assets/og-banner.png`. The build script will pick it up automatically on the next deploy.
- **Custom domain:** when `gocheck.app` (or another) is acquired, add it as a Vercel custom domain and set `EXPO_PUBLIC_WEB_BASE_URL=https://gocheck.app` in Vercel env. No code changes needed.
- **Per-bill OG image:** the static banner is fine for v1. A future enhancement could use Vercel OG Image API to render a per-bill card (title, amount, participant avatars). Out of scope here.
