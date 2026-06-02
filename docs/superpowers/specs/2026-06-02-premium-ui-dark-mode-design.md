# GoCheck — Premium UI Polish + Advanced Dark Mode Design

**Date:** 2026-06-02
**Status:** Approved

---

## Overview

Two tightly coupled workstreams delivered together:

1. **Advanced Dark Mode System** — fix the broken dark mode architecture, add a Deep Void premium palette, and animate the theme transition using Reanimated v3.
2. **Full App UI Polish** — elevate every screen and component to a premium, production-ready standard while preserving all existing animations and visual effects.

**Goal:** A user opens GoCheck and immediately thinks "this looks like a top-tier product." Every screen feels intentional, consistent, and polished in both light and dark mode.

---

## Critical Gap Fixed

Most screens currently `import { colors }` directly from `tokens.ts` instead of calling `useTheme()`. This means dark mode is silently broken for Home, Bills, Reports, and all modals. The fix is part of every screen's migration below.

---

## Part 1: Dark Mode Architecture

### 1.1 ThemeContext Changes (`src/theme/ThemeContext.tsx`)

Add a Reanimated shared value `themeProgress` (0 = light, 1 = dark) created inside `ThemeProvider` with `useSharedValue` and threaded through context:

```ts
// ThemeContext value shape expands to:
interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  themeProgress: SharedValue<number>; // NEW — Reanimated shared value
}
```

Inside `ThemeProvider`:

```ts
const themeProgress = useSharedValue(isDark ? 1 : 0);

useEffect(() => {
  themeProgress.value = withTiming(isDark ? 1 : 0, {
    duration: 250,
    easing: Easing.inOut(Easing.ease),
  });
}, [isDark]);
```

`useTheme()` continues to return `{ isDark, colors }` for all existing consumers — no breaking changes. Components that want the animated value destructure `themeProgress` from `useTheme()` explicitly.

### 1.2 Root-Level Animated Background (`app/_layout.tsx`)

Replace the static `bgColor` with an `AnimatedThemeRoot` component:

```tsx
function AnimatedThemeRoot({ children }: { children: React.ReactNode }) {
  const animBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      [colors.background, '#070710']
    ),
  }));
  return <Animated.View style={[{ flex: 1 }, animBg]}>{children}</Animated.View>;
}
```

This ensures the full-screen background animates on the GPU thread. Individual screens re-render reactively via React context and their colors update in the same frame — giving the appearance of a smooth B-style per-surface transition.

### 1.3 Deep Void Dark Palette Upgrades (`src/theme/ThemeContext.tsx`)

Replace the current `darkColors` with the refined Deep Void palette:

| Token | Current value | New Deep Void value |
|---|---|---|
| `background` | `#0A0A0F` | `#070710` |
| `surface` | `#13131A` | `#0F0F18` |
| `border` | `#1F2937` | `rgba(99,102,241,0.10)` |
| `divider` | `#1A1A24` | `rgba(255,255,255,0.04)` |
| `primarySurface` | `#1E1B4B` | `rgba(99,102,241,0.12)` |
| `primaryBorder` | `#3730A3` | `rgba(99,102,241,0.25)` |
| `secondarySurface` | `#064E3B` | `rgba(16,185,129,0.12)` |
| `errorSurface` | `#450A0A` | `rgba(239,68,68,0.12)` |
| `warningSurface` | `#451A03` | `rgba(245,158,11,0.12)` |
| `textPrimary` | `#F9FAFB` | `#F0F0FF` |
| `textSecondary` | `#9CA3AF` | `#8B8FA8` |

Add two new tokens to `darkColors` only:
- `surface2: '#141420'` — for card inner surfaces (participant rows, stats cards)
- `tabBarBg: 'rgba(7,7,16,0.88)'` — glassmorphic tab bar background

### 1.4 Dark Mode Toggle Enhancement (Profile Screen)

The existing `ToggleV2` component gets a glow pulse in dark mode: when `on === true`, add a Reanimated looping pulse animation (`withRepeat(withSequence(withTiming(1.0), withTiming(0.6)), -1, true)`) applied to a `shadowOpacity` animated style around the toggle track. The glow color is `rgba(99,102,241,0.5)`.

The `SettingRow` for Dark Mode gets an updated subtitle line showing `"Deep Void theme active"` / `"Light theme active"` based on state.

---

## Part 2: Screen-by-Screen UI Polish

### 2.1 Home Screen (`app/(tabs)/index.tsx`)

**Dark mode migration:**
- Add `const { colors: c } = useTheme()` and replace all `colors.xxx` references with `c.xxx`
- Exception: the Hero gradient uses hardcoded indigo values — keep them (they look correct in both modes)

**Visual polish:**
- `sectionTitle` font size: `fontSize.sm` (13px) → `fontSize.base` (15px) for stronger hierarchy
- `heroWrap` gets `marginHorizontal: spacing[4]` (currently spans edge-to-edge, which clips the indigo pulse shadow on iOS)
- `section` gap: `marginTop: spacing[4]` → `marginTop: spacing[5]` for more breathing room
- Empty state: the `emptyTitle` row already uses `ColourfulText` — keep it; add a `FadeInUp` wrapper with index 1 around the subtitle

**Preserved:** TiltCard, GlowingCard, DottedGlowBackground, AnimatedDonut, CountUp, AnimatedBar, SheenButton, GradientBorderRing, FadeInUp, AnimatedTooltipStack, ColourfulText — all unchanged.

### 2.2 Bills Screen (`app/(tabs)/bills.tsx`) — Major Redesign

This is the weakest screen. Full redesign of `BillCard` and the header.

**Header:**
- Remove `borderBottomColor`/`borderBottomWidth` — replace with no border (match Home's `topBar` style)
- Header background: `c.surface` (reactive to theme)
- Header buttons: replace plain `primarySurface` circles with the new icon-button style:
  - Bell: `backgroundColor: c.primarySurface`, `borderColor: c.primaryBorder`, `borderWidth: 1`
  - Plus/Create: filled indigo (`colors.primary`) with `shadowColor: colors.primary` glow

**Filter tabs:**
- Add the same horizontal filter strip from Home screen (`GradientBorderRing` pills: Active / Overdue / Recurring / All with counts)
- Uses `FlatList` `ListHeaderComponent` so it sticks to the top of the scroll content
- Active pill: `backgroundColor: colors.primary`, white text, indigo shadow glow

**BillCard redesign:**
- Replace static `progressBarFill` `View` with `AnimatedBar` (reusing the existing component — same props pattern as BillRowV2 in Home)
- Card body: remove the `cardActions` row entirely (Share Link + View Details buttons) — they clutter the card and duplicate functionality. Instead, the entire card is pressable. Share is accessible via the Bill Detail modal's share button.
- Card structure becomes identical to `BillRowV2` from Home (title + amount top row, meta below, AnimatedBar, avatar stack + status pill bottom row) for visual consistency
- Card background: `c.surface` with `border: 1px rgba(primary,0.12)` and `inset top highlight: rgba(255,255,255,0.04)`
- In dark mode: add a 1px top-edge gradient highlight via `::before` equivalent (a thin absolute-positioned View)
- Wrap each card in `FadeInUp` with staggered index for entrance animation (reusing existing component)
- Wrap card in `GlowingCard` (already used in Home's BillRowV2 — just bring Bills screen up to the same standard)

**Empty state:**
- Replace bare `Feather` icon with the same premium empty state pattern from Home:
  - `DottedGlowBackground` as backdrop
  - Centered icon circle with `secondarySurface` background
  - Title using `ColourfulText` for the key word
  - Subtitle with `FadeInUp`
  - CTA button using `SheenButton` (reusing existing component)

### 2.3 Reports Screen (`app/(tabs)/reports.tsx`)

**Header:**
- Remove `alignItems: 'center'` — left-align the title to match Home and Bills
- Remove `borderBottomWidth` / `borderBottomColor`
- `headerTitle` font size: `fontSize.lg` (20px) → matches the Bills/Profile pattern
- Background: `c.surface` (reactive)
- Add `const { colors: c } = useTheme()`

**Skeleton loading:**
- Replace static gray `SkeletonBlock` with an animated shimmer version
- Implementation: each block uses a Reanimated `useSharedValue` with `withRepeat(withSequence(withTiming(1, {duration: 900}), withTiming(0, {duration: 900})), -1)` driving `opacity` between `0.4` and `0.8` — a gentle pulse
- The two skeleton blocks in a row stay as-is (layout is correct), just add the pulse animation

**Empty state:**
- Upgrade from bare icon to the same premium pattern as Bills empty state
- Keep the "Create a bill" CTA button, wrap in `SheenButton`

**Child components** (StatCardRow, ForecastCard, CategoryCard, ReliabilityCard, ExportCard, ReportsSummaryStrip):
- Each needs `const { colors: c } = useTheme()` added and `colors.xxx` replaced with `c.xxx`
- No structural changes — layout is already good

### 2.4 Profile Screen (`app/(tabs)/profile.tsx`)

**Header area:**
- Add a subtle radial gradient behind the "Profile" title: `LinearGradient` from `rgba(99,102,241,0.12)` at top-left to `transparent` at 55% height
- Add subtitle line below the title: `"Manage your account & preferences"` in `textSecondary`

**Profile card:**
- Add a 5px gradient banner strip at the top of the card: `LinearGradient` horizontal from `colors.primary` → `colors.primaryLight` → `colors.secondary`
- Avatar: add `shadowColor: colors.primary`, `shadowOpacity: 0.35`, `shadowRadius: 16`, `elevation: 8` to create indigo avatar glow
- `organizerBadge`: add `borderWidth: 1`, `borderColor: c.primaryBorder` for definition

**Settings rows (all screens):**
- Add `useTheme()` to `SettingRow` and `SettingSection` components
- `SettingSection` background: `c.surface`
- `SettingRow` background: `c.surface`, border: `c.divider`

**Dark Mode toggle row specifically:**
- Dynamic subtitle: `"Deep Void theme active"` when on, `"Light mode active"` when off
- `ToggleV2`: add Reanimated glow pulse animation when `on === true` (see 1.4 above)

### 2.5 Tab Bar (`app/(tabs)/_layout.tsx`) — Floating Rounded Bar

**Design: Option A — Floating pill lifted off the bottom edge.**

The tab bar detaches from the screen bottom and becomes a floating rounded card, giving GoCheck an immediately distinctive look that signals "premium product."

**Layout structure:**
- Remove the default `tabBarStyle` entirely from `<Tabs screenOptions>`
- Render a fully custom `tabBar` prop component: `tabBar={(props) => <FloatingTabBar {...props} />}`
- `FloatingTabBar` is a new component in `app/(tabs)/_layout.tsx`

**FloatingTabBar visual spec:**
```
[safe area bottom padding]
[8px gap from screen edge]
[floating pill — borderRadius: 28, height: 64]
[8px gap from pill to screen edge — not touching sides]
```
- `marginHorizontal: 16` — pill floats with side gap
- `marginBottom: 8 + insets.bottom` — lifted off bottom
- `borderRadius: 28` — fully rounded pill shape
- Background dark: `rgba(10,10,20,0.88)` + `BlurView intensity={24} tint="dark"`
- Background light: `rgba(255,255,255,0.9)` + `BlurView intensity={20} tint="light"`
- Border: `1px solid rgba(99,102,241,0.18)` dark / `rgba(99,102,241,0.12)` light
- Top-edge shimmer line: absolute positioned 1px `LinearGradient` from `transparent → rgba(99,102,241,0.5) → rgba(99,102,241,0.3) → transparent`, gives the glass a lit top edge
- Shadow: `shadowColor: '#4F46E5'`, `shadowOpacity: 0.18`, `shadowRadius: 24`, `shadowOffset: { width: 0, height: -4 }`, `elevation: 16`

**Active tab indicator — animated glow pill:**
- Each tab renders an `Animated.View` inner pill with `borderRadius: 16`
- Active: `backgroundColor` animates to `rgba(99,102,241,0.18)` dark / `rgba(99,102,241,0.1)` light via `withTiming(1, { duration: 200 })`
- Active also gets: `boxShadow` equivalent — `shadowColor: '#6366F1'`, `shadowOpacity: 0.35`, `shadowRadius: 12` on the pill container

**Active underline dot:**
- A 16×2px absolute `View` below the icon, `borderRadius: 1`, background `#6366F1`
- `shadowColor: '#6366F1'`, `shadowOpacity: 0.9`, `shadowRadius: 6` — a sharp indigo glow dot
- Animates `opacity` 0→1 with `withSpring({ damping: 16, stiffness: 200 })`

**Animations on tab press:**
1. **Icon scale bounce**: `withSpring(1.18, { damping: 10, stiffness: 280 })` then back to 1.0 — a quick bounce up on press
2. **Pill opacity spring**: `withSpring(1, { damping: 18, stiffness: 220 })` from 0 when newly active
3. **Icon glow**: active icon `Feather` renders with a `shadowColor` matching the tab's semantic color (Home=indigo, Bills=indigo, Reports=emerald, Profile=indigo), `shadowOpacity: animatedValue`, `shadowRadius: 8`
4. **Inactive fade**: non-active icon opacity transitions to 0.28 via `withTiming(0.28, { duration: 180 })`
5. **Haptic**: `haptic.selection()` on every tab switch (reusing existing `src/lib/haptics.ts`)

**Icon sizes:** 20px for inactive, 22px for active (driven by Reanimated interpolation on the shared value)

### 2.6 BillDetailModal (`src/components/dashboard/BillDetailModal.tsx`)

**Stats card:**
- `backgroundColor: colors.gray50` → `c.surface2` (new dark token) or `c.gray50` in light
- Add `borderWidth: 1`, `borderColor: c.border` for definition in both modes

**Participant rows:**
- Replace plain `backgroundColor: colors.surface` + gray border with `GlowingCard` (same as Home nudge rows) — this brings consistency and the interactive hover/glow effect
- Glow color: participant's `avatarColor` when unpaid, `colors.secondary` when paid

**Open Full Bill CTA:**
- Replace `backgroundColor: colors.gray900` with a `LinearGradient` from `colors.primary` to `colors.primaryDark`
- Add `shadowColor: colors.primary`, `shadowOpacity: 0.35`, `shadowRadius: 12` for the indigo glow
- Text: keep white, add `Feather arrow-right` icon (already there)

---

## Part 3: New Micro-interactions & Animations

All of these use existing libraries already in the project (Reanimated v3, expo-linear-gradient).

| Interaction | Component | Implementation |
|---|---|---|
| Shimmer skeleton | Reports SkeletonBlock | Reanimated opacity pulse 0.4→0.8, 900ms, infinite repeat |
| Staggered list entrance | Bills BillCard items | `FadeInUp` with `index={i}` — already used in Home, apply same pattern |
| Tab pill spring | Tab bar active indicator | `withSpring` scale+opacity on tab focus change |
| Dark mode toggle glow | Profile ToggleV2 (dark=on) | Reanimated `withRepeat(withSequence(...))` on shadow opacity |
| Button press scale | All `Pressable` buttons | Add `transform: [{ scale: pressed ? 0.97 : 1 }]` with spring — subtle but premium |
| Hero section entrance | Home hero card | Already has TiltCard + FadeInUp — keep exactly as-is |
| Animated progress in dark | Bills AnimatedBar | Dark mode: `fillColor` gets `shadowColor` + `shadowRadius: 8` for glow bar effect |

---

## Part 4: Signature Effects — PRESERVE EXACTLY, DO NOT MODIFY

These are GoCheck's core visual identity. They must not be removed, simplified, or altered. Any screen or component that currently uses them must continue using them after changes.

### 4.1 TiltCard — 3D Perspective Tilt (Perplexity Comet style)
- **File:** `src/components/effects/TiltCard.tsx`
- **Used on:** Home screen hero card
- **What it does:** Gyroscope/pointer-driven 3D perspective transform. On native, uses device motion for real tilt. On web, follows cursor position.
- **Rule:** Do not remove from the Home hero. Do not simplify the perspective math. Do not reduce the tilt depth.

### 4.2 GlareCard — Hover Glare Reflection (Linear style)
- **File:** `src/components/effects/GlareCard.tsx`
- **What it does:** A specular light reflection that tracks pointer/touch position across the card surface — the bright "glare" spot moves with the cursor on web.
- **Rule:** Keep all pointer/touch tracking logic intact. Do not remove the glare overlay. Do not reduce opacity or blur.

### 4.3 ColourfulText + AppText — Animated Rainbow Text (Character-level)
- **Files:** `src/components/effects/ColourfulText.tsx`, `src/components/AppText.tsx`, `src/theme/ColourfulClockContext.tsx`
- **What it does:** Each character cycles through a palette of colours in sequence, synchronized across all `AppText` instances via `ColourfulClockContext`. Creates a living, breathing text effect throughout the whole app.
- **Rule:** Do not remove `ColourfulClockProvider` from root layout. Do not replace `AppText` with plain `Text`. Do not change the colour cycling logic in `ColourfulClockContext`. The rainbow effect is a deliberate brand signature.

### 4.4 GradientBorderRing — Animated Moving Border
- **File:** `src/components/effects/GradientBorderRing.tsx`
- **What it does:** A gradient border that rotates/animates around its container. Makes buttons and filter pills visually stand out with a living border effect.
- **Used on:** Home screen filter tabs
- **Rule:** Keep on all filter tabs in Home. When Bills screen adds filter tabs (Part 2.2), wrap them in `GradientBorderRing` exactly as Home does. Do not swap for a static border.

### 4.5 All Other Preserved Effects

These must also be kept exactly as-is:

| Effect | File | Used on |
|---|---|---|
| `GlowingCard` | `effects/GlowingCard.tsx` | Bill rows, nudge rows, profile card, Bills cards |
| `DottedGlowBackground` | `effects/DottedGlowBackground.tsx` | Home hero, empty states |
| `AnimatedDonut` | `effects/AnimatedDonut.tsx` | Home hero progress ring |
| `CountUp` | `effects/CountUp.tsx` | Home hero amount |
| `AnimatedBar` | `effects/AnimatedBar.tsx` | All progress bars — do not replace with static View |
| `FadeInUp` | `effects/FadeInUp.tsx` | All section/card entrance animations |
| `SheenButton` | `effects/SheenButton.tsx` | "New bill" button on Home |
| `AuroraBackground` | `effects/AuroraBackground.tsx` | Create bill modal |
| `BeamBackground` | `create/BeamBackground.tsx` | Create bill modal |
| `GlowingSection` | `create/GlowingSection.tsx` | Create bill modal form sections |
| `AnimatedTooltipStack` | `dashboard/AnimatedTooltipStack.tsx` | Bill row avatar stacks |
| `ConfettiBurst` | `common/ConfettiBurst.tsx` | Success states |
| `NoiseBackground` | `effects/NoiseBackground.tsx` | Where currently used |
| All spring configs | `theme/tokens.ts` | `springSnappy`, `springBouncy`, `springGentle` |
| All haptics | `lib/haptics.ts` | Every interactive element |

---

## Implementation Order

1. **ThemeContext** — add `themeProgress`, update `darkColors` to Deep Void palette
2. **`_layout.tsx`** — `AnimatedThemeRoot`, wire `themeProgress`
3. **Tab bar** — glassmorphic + pill indicator (most visible, immediate wow factor)
4. **Profile screen** — header gradient, profile card banner, toggle glow, `useTheme` migration
5. **Home screen** — `useTheme` migration + minor spacing/hierarchy polish
6. **Bills screen** — full `BillCard` redesign, filter strip, empty state, `useTheme`
7. **Reports screen** — header alignment, shimmer skeleton, empty state, `useTheme`; child components migration
8. **BillDetailModal** — stats card, participant rows, CTA gradient
9. **ToggleV2** — glow pulse animation when on

---

## Files Changed

| File | Change type |
|---|---|
| `src/theme/ThemeContext.tsx` | Modify — `themeProgress`, Deep Void palette |
| `app/_layout.tsx` | Modify — `AnimatedThemeRoot` |
| `app/(tabs)/_layout.tsx` | Modify — glassmorphic tab bar, pill indicator |
| `app/(tabs)/index.tsx` | Modify — `useTheme`, spacing polish |
| `app/(tabs)/bills.tsx` | Modify — full BillCard redesign, filter strip |
| `app/(tabs)/reports.tsx` | Modify — header, shimmer, `useTheme` |
| `app/(tabs)/profile.tsx` | Modify — header gradient, card banner, `useTheme` |
| `src/components/dashboard/BillDetailModal.tsx` | Modify — statsCard, partRow, CTA |
| `src/components/profile/ToggleV2.tsx` | Modify — glow pulse animation |
| `src/components/profile/SettingRow.tsx` | Modify — `useTheme` |
| `src/components/profile/SettingSection.tsx` | Modify — `useTheme` |
| `src/components/reports/StatCardRow.tsx` | Modify — `useTheme` |
| `src/components/reports/ForecastCard.tsx` | Modify — `useTheme` |
| `src/components/reports/CategoryCard.tsx` | Modify — `useTheme` |
| `src/components/reports/ReliabilityCard.tsx` | Modify — `useTheme` |
| `src/components/reports/ExportCard.tsx` | Modify — `useTheme` |
| `src/components/reports/ReportsSummaryStrip.tsx` | Modify — `useTheme` |
