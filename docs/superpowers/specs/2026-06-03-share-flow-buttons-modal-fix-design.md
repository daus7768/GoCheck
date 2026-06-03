# Share Flow, Hold-to-Confirm Buttons, and Web Modal Viewport Fix — Design

**Date:** 2026-06-03
**Status:** Draft for review
**Author:** daus

## Background

QA on the live web build surfaced three independent defects and one polish ask:

1. **Group bill share link doesn't resolve.** The share message published to WhatsApp/Gmail uses `https://gocheck.app/share/{code}`, but `gocheck.app` has no DNS — visitors hit `ERR_CONNECTION_TIMED_OUT`. The actual deployment lives at `go-check.vercel.app`.
2. **The group share landing page is visually mismatched** with the polished participant page (`/p/{token}`). Even if the link worked, the destination doesn't reflect the app's brand.
3. **Bill detail action buttons (Mark Complete, Delete) feel pedestrian.** Plain Pressables fronted by `Alert.alert` — no celebration on complete, no safety/feedback on delete.
4. **React Native `<Modal>` escapes the phone shell on web.** Sheets render at the browser viewport edge instead of inside the 430px centred phone column. One component (`BillDetailModal`) already has a per-component fix; seven other files still leak.

The participant payment flow at `app/p/[token].tsx` is explicitly **out of scope**. It stays exactly as-is.

## Goals

- A group bill share URL that actually resolves and previews well in WhatsApp/Gmail.
- A group bill landing page that visually belongs to GoCheck and that gracefully hands off to the per-participant payment flow.
- Two action buttons (Complete, Delete) that are safer and more delightful than the current tap-then-Alert pattern.
- All web `<Modal>` usages constrained to the phone shell, with native behavior unchanged.

## Non-Goals

- Custom domain (`gocheck.app`) — user will buy and switch later. The implementation must make that flip a one-line env-var change, no more.
- Dynamic per-bill OpenGraph images — static branded banner only.
- Replacing the per-participant page (`/p/{token}`) or the participant payment flow primitives.
- New shared portal target / ModalShell architecture — per-component conditional pattern instead.

## Architecture overview

Three independent change groups that share no runtime state:

```
+-----------------------------+   +------------------------------+   +-----------------------------+
| Project A                   |   | Project B                    |   | Project C                   |
| Share flow + landing page   |   | Hold-to-Confirm buttons      |   | Web Modal viewport fix      |
|                             |   |                              |   |                             |
| - src/lib/share.ts          |   | - src/components/common/     |   | - 7 files, 8 Modal usages   |
| - src/lib/ogTags.ts (new)   |   |   HoldToConfirm.tsx (new)    |   | - Mirror BillDetailModal's  |
| - app/(modals)/share/       |   | - app/(modals)/bill/[id].tsx |   |   per-component pattern     |
|   [code].tsx (rewrite)      |   |   (swap in HoldToConfirm)    |   |                             |
| - app.json (shareBaseUrl)   |   |                              |   |                             |
| - assets/og-banner.png (new)|   |                              |   |                             |
+-----------------------------+   +------------------------------+   +-----------------------------+
```

## Project A — Group Bill Share + Landing Page

### A1. Share URL plumbing

**Single source of truth.** Today, `src/lib/urls.ts` (participant URLs) reads `EXPO_PUBLIC_WEB_BASE_URL`, while `src/lib/share.ts` (bill URLs) reads `Constants.expoConfig.extra.shareBaseUrl`. Consolidate on the env var so the same flip works for both flows.

**Changes:**

- `src/lib/share.ts`
  - Replace `getShareBase()` to read `process.env.EXPO_PUBLIC_WEB_BASE_URL` first, then `Constants.expoConfig.extra.shareBaseUrl`, then default `'https://go-check.vercel.app'`. Returns base **without** `/share`.
  - `getBillShareUrl(shareLink)` returns `${base}/share/${shareLink}`.
  - Keep the existing `shareBillLink()` API surface intact.
- `app/(modals)/share/[code].tsx` lines 99–104
  - Delete the inline `Share.share()` call with the broken `gocheck.app/bill/${code}` URL.
  - Call the shared `shareBillLink()` from `src/lib/share.ts` instead. (This file currently doesn't import it — it predates the helper.)
- `app.json`
  - Add `expo.extra.shareBaseUrl: "https://go-check.vercel.app"` so users without `.env` still get the right default.
- `.env.example` (create if missing) or document in `DEVELOPMENT.md`:
  - `EXPO_PUBLIC_WEB_BASE_URL=https://go-check.vercel.app`
  - Note: when custom domain ships, change this one variable.

### A2. Group bill landing page — `/share/{code}` rewrite

The existing page (`app/(modals)/share/[code].tsx`) has the right data fetching (`getBillByShareLink`) but the wrong UX. It exposes a "Pay" button per participant that just marks them paid with no proof — a footgun for a public link. The redesign makes it **read-only** and delegates payment to the per-participant flow.

**Visual reference:** the participant page at `app/p/[token].tsx` is the design language target. Reuse:

- The `BeamBackdrop` component (currently inline in `app/p/[token].tsx`) — extract to `src/components/effects/BeamBackdrop.tsx` so both pages share it.
- The cosmic gradient + amount panel pattern from `app/p/[token].tsx` lines 286-361.
- The brand header pattern (logo + ColourfulText "GoCheck" + status pill).

**Page structure (top to bottom):**

1. **Brand header** — GoCheck logo + ColourfulText name + status pill "Group bill"
2. **Invoice card** (white surface on cosmic backdrop):
   - Header: `BILL INVOICE` label, title, optional description, share code in monospace
   - Amount panel (dark gradient): "Total amount" label + total + due date
   - Meta grid (2x2): Organizer · Due date · Currency · `{paid}/{total} paid`
   - Animated progress bar showing collection percentage
3. **Participants section**:
   - Each participant row in a sub-card: avatar + name + amount + status pill
   - For unpaid participants **with** an `accessToken`: a "This is me — pay my share" button that navigates to `/p/{accessToken}` (in-app router push on native, `window.location.href` on web for full nav).
   - For unpaid participants **without** an `accessToken` (legacy data): show a muted "Ask organizer for your link" hint instead.
4. **Footer:** `Secure record by GoCheck`

**Read-only guarantees:**
- Remove `handleMarkPaid` and `markParticipantPaid` import — the page never mutates state. Users pay through `/p/{token}` only.
- Keep `loadBill` / `getBillByShareLink` to fetch and display.
- Add realtime subscription on the bill's `participants` table (same pattern as `app/p/[token].tsx` lines 197-209) so the progress updates live when someone pays.

**Data fields needed (from `getBillByShareLink`):**
- `accessToken` per participant — already in the type but not surfaced in the current `BillData` interface in `share/[code].tsx`. Extend that interface. Verify `getBillByShareLink` in `src/lib/supabase.ts` actually returns this field — if not, update the query.

### A3. OpenGraph link preview

WhatsApp / iMessage / Slack call `og:title`, `og:description`, `og:image` to generate a link card. Setting them client-side works for WhatsApp (its crawler executes JS within a small budget) and most chat apps; not perfect but a quick, infra-free win.

**New file: `src/lib/ogTags.ts`**

```ts
// Web-only helper to inject/update OpenGraph + Twitter Card meta tags.
// No-op on native.
export function setOgTags(opts: {
  title: string;
  description: string;
  image?: string;
  url?: string;
}) { /* ... */ }
```

It manages a stable set of `<meta>` tags by `data-og-managed="true"` so repeated calls update instead of duplicating.

**Caller:** `/share/[code].tsx` calls `setOgTags` from a `useEffect` after `bill` loads:
- `title`: bill title
- `description`: `"{paid}/{total} paid · {symbol}{total} due {date}"`
- `image`: `${base}/assets/og-banner.png` (static brand banner)
- `url`: `window.location.href`

**New asset: `assets/og-banner.png`**
- 1200x630 PNG, cosmic gradient + GoCheck logo + tagline
- Placed in `assets/` so it ships with the bundle. Vercel serves it under `/assets/og-banner.png`.

**Static fallback in build output:**
- After `expo export -p web`, the build emits `dist/index.html`. Add a post-build Node script `scripts/inject-og-tags.js` invoked from the npm `build` command after `expo export` — it reads `dist/index.html` and injects default OG meta tags (generic "GoCheck — Split bills, settle smart" title + the static banner image). This guarantees a baseline preview for any link, even before the JS bundle executes. Per-bill specifics are layered on top by the client-side `setOgTags` call once the bundle loads.

## Project B — Hold-to-Confirm Buttons

### B1. New primitive: `src/components/common/HoldToConfirm.tsx`

```tsx
type HoldToConfirmProps = {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  variant: 'success' | 'destructive';
  holdDuration?: number;        // default 1200ms
  onConfirm: () => void | Promise<void>;
  onConfirmAnimation: 'confetti' | 'shake-dissolve';
  disabled?: boolean;
};
```

**State machine:**

- `idle` — button at rest
- `holding` — on `onPressIn`, drive a Reanimated `progress` shared value with `withTiming(1, { duration: holdDuration, easing: Easing.linear }, finished => { if (finished) runOnJS(handleConfirmed)(); })`. The callback fires **only on natural completion**; cancellation (see below) does not invoke it, which is the cleanest way to gate confirmation.
- `confirmed` — the `withTiming` finished callback runs on JS, fires `onConfirm` and mounts the chosen finale animation.
- `cancelled` — on `onPressOut` while `progress < 1`, call `cancelAnimation(progress)` then spring back with `withSpring(0, { damping: 18, stiffness: 220 })`. No callback fires.

**Visual:**

- Outer `Pressable` with rounded XL container
- An absolute-fill `Animated.View` with the variant's fill color (`colors.secondary` for success, `colors.error` for destructive). Width animates from `0%` to `100%` via `useAnimatedStyle`.
- Label + icon rendered above the fill with white text (always legible — the fill is dark enough)
- Optional shimmer overlay on the fill for premium feel (reuse `SheenButton` pattern if cheap)
- Slight scale-down (`scale: 0.98`) while holding

**Haptics** (via existing `src/lib/haptics.ts`):
- `haptic.selection()` on press-in
- `haptic.impact()` on confirm
- Soft `haptic.selection()` on cancel

**Accessibility:**
- `accessibilityRole="button"`
- `accessibilityLabel` includes the variant ("Mark bill as complete, hold to confirm")
- `accessibilityHint`: "Press and hold for 1.2 seconds"
- For users with `prefers-reduced-motion` (already detected via `useReduceMotion`): fall back to a single-tap-with-confirm-dialog. The hold-to-confirm interaction is motion-driven and not usable for users who need motion reduced.

**Cancellation safety:**
- If the component unmounts mid-hold, cancel the Reanimated animation (`cancelAnimation`) to prevent the `progress.value = 1` reaction from firing post-unmount.

### B2. Complete variant — celebration finale

When `progress` hits 1.0:

1. Mount `ConfettiBurst` and `SuccessCheck` overlay (see scope below)
2. Trigger `onConfirm` (async — calls `updateBillStatus`)
3. After ~1500ms, unmount both
4. The parent screen sees `bill.status === 'complete'` and re-renders without the action buttons

**Overlay scope (deliberate):** the celebration overlay is mounted by `HoldToConfirm` itself as a sibling using `StyleSheet.absoluteFillObject` with a high `zIndex`. Its bounds are the **nearest positioned ancestor**. In the BillDetailScreen, the ScrollView contentContainer wraps everything — confetti will fill the visible card area, not the entire device screen. This is intentional: card-level celebration matches modern mobile UI patterns (think Linear, Things 3), avoids needing a portal target, and keeps the component self-contained. If a full-screen feel is wanted later, lift the overlay to a sibling of the navigator.

### B3. Destructive variant — shake + dissolve

When `progress` hits 1.0:

1. Trigger `onConfirm` (async — calls `deleteBill`, then `router.back()`)
2. The parent wraps the BillDetailScreen body in an `Animated.View` whose style is bound to a shared value `dissolveProgress`:
   - 0→1 over 280ms: opacity 1→0, scale 1→0.92
3. Before dissolve, a 60ms shake animation: `translateX` cycles `[-8, 8, -6, 6, -3, 3, 0]`
4. After dissolve completes, `router.back()` fires
5. If `deleteBill` errors: reverse the animation, show inline error toast (use existing `BatchToast` pattern), keep the user on the page

For this to work, the **parent screen** (`app/(modals)/bill/[id].tsx`) owns the `dissolveProgress` shared value and passes a callback to `HoldToConfirm`:

```tsx
<HoldToConfirm
  variant="destructive"
  onConfirm={triggerDissolveAndDelete}
  onConfirmAnimation="shake-dissolve"
/>
```

Where `triggerDissolveAndDelete`:
1. Plays shake animation
2. Plays dissolve animation
3. After dissolve: calls `deleteBill`, then `router.back()`

### B4. Wiring in `app/(modals)/bill/[id].tsx`

- Remove lines 110–158 (`handleComplete`, `handleDelete` with `Alert.alert`).
- Add `handleCompleteAsync` and `handleDeleteAsync` — plain async functions that call the API and update state. No more dialogs.
- Lines 315–340: replace the two `Pressable` components with:

```tsx
{bill.status === 'active' && (
  <View style={styles.actions}>
    <HoldToConfirm
      label="Hold to complete bill"
      icon="check-circle"
      variant="success"
      onConfirm={handleCompleteAsync}
      onConfirmAnimation="confetti"
      disabled={actionLoading}
    />
    <HoldToConfirm
      label="Hold to delete bill"
      icon="trash-2"
      variant="destructive"
      onConfirm={handleDeleteAsync}
      onConfirmAnimation="shake-dissolve"
      disabled={actionLoading}
    />
  </View>
)}
```

- Remove the old `completeBtn` / `deleteBtn` / `completeBtnText` / `deleteBtnText` style entries (no longer used).

## Project C — Web Modal Viewport Fix

### C1. Pattern (per-component, mirroring `BillDetailModal.tsx`)

For each Modal, conditionally render a plain absolute-fill `<View>` on web instead of `<Modal>`:

```tsx
const overlay = (
  // existing modal content unchanged
);

if (Platform.OS === 'web') {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="auto">
      {overlay}
    </View>
  );
}

return (
  <Modal transparent visible={visible} animationType="..." onRequestClose={onClose}>
    {overlay}
  </Modal>
);
```

Why this works: the phone shell at `app/_layout.tsx` `styles.webPhone` has `overflow: 'hidden'` and `flex: 1`. Children with `position: absolute` are positioned relative to the nearest positioned ancestor and clipped by the overflow rule. The web `<View>` falls inside this constraint; the RN `<Modal>` does not because it portals to `document.body`.

### C2. Files (7 files, 8 Modal instances)

| File | Modal purpose | Animation | Notes |
|---|---|---|---|
| `src/components/bill/BillCreatedSheet.tsx` | Bill creation success sheet | slide | Convert single Modal |
| `src/components/profile/SignOutOverlay.tsx` | Sign-out splash | fade | Convert single Modal |
| `src/components/payment/PaymentReviewSheet.tsx` | Review submitted proof | slide | Convert (line 87) |
| `src/components/payment/PaymentReviewSheet.tsx` | Full-screen image viewer | fade | Convert (line 164) — nested modal, needs Escape key + backdrop tap |
| `src/components/create/CurrencySelector.tsx` | Currency picker | slide | Convert single Modal |
| `src/components/create/AddParticipantModal.tsx` | Add participant form | slide | Convert; verify KeyboardAvoidingView still no-ops on web (it does) |
| `app/(tabs)/profile.tsx` | Display name editor (line 379) | fade | Convert |
| `app/(tabs)/profile.tsx` | Default currency picker (line 418) | fade | Convert |

### C3. Cross-cutting details per file

- **`statusBarTranslucent`** — drop on web branch (Android-only prop, harmless but cleaner)
- **`onRequestClose`** — Android-back equivalent. On web, wire `Escape` key:
  ```tsx
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [visible, onClose]);
  ```
  Apply to: CurrencySelector, AddParticipantModal, PaymentReviewSheet (both), profile.tsx modals. **Skip** for SignOutOverlay (no close), BillCreatedSheet (no close — auto-advance).
- **Animation preservation** — the existing `animationType="slide"` / `"fade"` is RN-only and ignored on web. The components already manage their own Reanimated entrance animations independently (or should — verify per file during implementation), so the web branch loses nothing visually.
- **`pointerEvents`** — when `visible` is false on web, return `null` so the absolute-fill View never blocks clicks behind the phone shell.

### C4. Out of scope

- `BillDetailModal.tsx` — already has this fix.
- The new `/share/{code}` and `/p/{token}` pages — they're full screens, not modals.
- Any `bottom-sheet` library modals — audit returned none.

## Data flow & integration

```
Organizer creates bill
       |
       v
App generates shareLink (random code) per bill + accessToken per participant
       |
       +--> shareLink saved on bill row
       +--> accessToken saved on each participant row
       |
       v
Organizer taps share → shareBillLink(bill) → Share.share({
  message: 'Pay your share for "{title}": https://go-check.vercel.app/share/{shareLink}'
})
       |
       v (in WhatsApp/Gmail)
Visitor sees rich preview (OG tags injected once landing page loads)
       |
       v
Visitor taps link → /share/{shareLink} renders cosmic group invoice
       |
       v
Unpaid participant taps "This is me → pay my share"
       |
       v
Navigates to /p/{accessToken} → existing participant flow (unchanged)
```

Realtime: both `/share/{code}` and `/p/{token}` subscribe to `participants` table changes for their bill, so the group view updates live as people pay.

## Error handling

**Project A:**
- `getBillByShareLink` failure (network, invalid code) — show the existing error card with cosmic backdrop, "Bill not found" message, retry button
- Missing `accessToken` for a participant — show muted "Ask organizer for your link" hint instead of broken "Pay my share" button
- OG tag injection failure (e.g., `document.head` unavailable in some edge cases) — silent no-op; the page still works

**Project B:**
- `updateBillStatus` / `deleteBill` API failure — for Complete: keep the celebration animation playing, then on error reverse status and show inline error. For Delete: cancel the dissolve animation, restore the page, show error toast
- User unmounts mid-hold — `cancelAnimation` on the progress shared value, no `onConfirm` fires
- `prefers-reduced-motion` — fall back to single-tap with `Alert.alert` confirmation (the existing behavior)

**Project C:**
- Modal content errors — unchanged from current behavior (each modal handles its own state)
- Escape key handler attached when invisible — short-circuit early if `!visible`

## Testing

**Manual QA checklist** (web):
- Send a share link via WhatsApp Web — verify URL resolves and preview shows GoCheck banner + bill info
- Open `/share/{code}` on web — verify cosmic backdrop, invoice layout, all participants render
- Tap "This is me — pay my share" — verify navigation to `/p/{token}` and the existing flow works
- On a bill detail page, hold the Complete button — verify progress fills, confetti plays, status updates
- On a bill detail page, hold the Delete button — verify shake → dissolve → navigation back
- Release the hold button early — verify cancel haptic + progress springs back
- Open each of the 7 converted modals on web — verify they stay within the 430px phone column

**Manual QA checklist** (native iOS / Android):
- Same modal list — verify behavior is identical to today (Modal still wraps the content on native)
- Hold-to-confirm haptics fire correctly
- Confetti and dissolve animations run at 60fps

**No unit tests added** — these are visual/interaction changes that rely on Reanimated and platform-specific rendering. Manual QA is the primary verification.

## Migration / rollback

- Project A: change is non-breaking. Old share links with `gocheck.app` still won't work (no DNS), but new ones will. No data migration.
- Project B: changing only the UI of the bill detail page; underlying APIs (`updateBillStatus`, `deleteBill`) unchanged.
- Project C: each file is independent. Can ship them one at a time. Native unchanged. Rollback = revert single commits.

## Open questions

None. All decisions captured during brainstorming:
- Domain: `go-check.vercel.app`, env-var driven for future flip
- Landing page: read-only group invoice with handoff to `/p/{token}`
- OG tags: static client-side injection
- Buttons: Hold-to-Confirm for both, confetti for Complete, shake+dissolve for Delete
- Modal fix: per-component, mirror BillDetailModal pattern

## Implementation order (suggested)

1. Project C (Modal fix) — smallest blast radius, easiest to test, ships quickest
2. Project A (Share + landing) — touches share helpers, depends on no other work
3. Project B (Hold-to-confirm) — depends on `ConfettiBurst` / `SuccessCheck` (both already exist); HoldToConfirm primitive is reusable beyond just these two buttons

Each project can ship as its own commit (and reasonably its own PR).
