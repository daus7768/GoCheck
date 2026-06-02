# Global ColourfulText Design

**Date:** 2026-06-02  
**Status:** Approved

## Overview

Apply per-character colour cycling to every `<Text>` element across the entire GoCheck app, using a single global animation clock so the effect is performant regardless of how many text nodes are on screen at once.

---

## Architecture

### 1. Global Animation Clock — `ColourfulClockContext`

**File:** `src/theme/ColourfulClockContext.tsx`

- Holds one `useSharedValue(0)` that runs a `withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false)` loop — matching the timing of the existing `ColourfulText` component.
- Exposes the shared value via a `useColourClock()` hook.
- Respects `useReduceMotion()`: if reduced motion is enabled, the clock stays at `0` (text renders in the first palette colour, static — no animation loops started).
- Provider is mounted once in `app/_layout.tsx`, inside the existing `ThemeProvider`.

```
_layout.tsx
  └── ThemeProvider
        └── ColourfulClockProvider   ← new
              └── app screens
```

### 2. `<AppText>` Component

**File:** `src/components/AppText.tsx`

- Accepts all standard React Native `<Text>` props (`style`, `numberOfLines`, `onPress`, `accessibilityLabel`, etc.) via spread.
- Splits `string` children into characters.
- Each character renders as a `Glyph` that reads the global clock and computes colour via `interpolateColor(clock.value + index * staggerOffset, inputRange, palette)`.
- No per-character `useSharedValue` or animation loop — zero additional animation overhead per node.
- `style` is forwarded intact to each `Animated.Text` glyph so all layout properties (fontSize, fontFamily, fontWeight, textAlign, lineHeight) are preserved exactly.
- Non-string children (React elements, numbers cast to string) fall back gracefully.
- Default palette: indigo → indigo-light → emerald → emerald-light → indigo (same as existing `DEFAULT_PALETTE` in `ColourfulText.tsx`).
- Default letter stagger: 90 ms (same as existing component).

### 3. Migration

Replace every `<Text>` usage with `<AppText>` across all screen and component files.

**Files to migrate (~15 files):**

| Location | Files |
|----------|-------|
| `app/(tabs)/` | `index.tsx`, `bills.tsx`, `reports.tsx`, `profile.tsx` |
| `app/(modals)/` | `create.tsx`, `reminders.tsx`, `bill/[id].tsx`, `share/[code].tsx` |
| `app/auth/` | `sign-in.tsx` |
| `src/components/bill/` | `BillCreatedSheet.tsx`, `SuccessCheck.tsx` |
| `src/components/dashboard/` | `BillDetailModal.tsx`, `StatusPill.tsx`, `AnimatedTooltipStack.tsx` |
| `src/components/create/` | all files |
| `src/components/payment/` | all files |
| `src/components/profile/` | all files |
| `src/components/reminders/` | all files |
| `src/components/reports/` | all files |
| `src/components/common/` | `ConfettiBurst.tsx` |

**Carve-outs (do NOT touch):**
- `<TextInput>` — never `<Text>`, unaffected.
- `Animated.Text` inside `src/components/effects/ColourfulText.tsx` and `CountUp.tsx` — already under their own animation system.
- `<ColourfulText>` usages stay as-is (used for intentional per-instance stagger on specific accent words like "settled").

**Import pattern per file:**
```ts
// Before
import { Text } from 'react-native';
// After
import { AppText } from '../../components/AppText'; // path adjusted per depth
```

```tsx
// Before
<Text style={styles.title}>Hello</Text>
// After
<AppText style={styles.title}>Hello</AppText>
```

---

## Data Flow

```
ColourfulClockProvider
  sharedClock (useSharedValue 0→1, repeating)
        │
        ▼  useColourClock()
  AppText (any screen)
    ├── Glyph index 0  →  interpolateColor(clock + 0 * 0.09s)
    ├── Glyph index 1  →  interpolateColor(clock + 1 * 0.09s)
    └── Glyph index N  →  interpolateColor(clock + N * 0.09s)
```

All glyphs app-wide share the same animation driver — one RAF loop total.

---

## Accessibility

- `useReduceMotion()` checked once in `ColourfulClockContext`. If true, clock stays at `0`, no animation started, all text renders in `palette[0]` (indigo) statically.
- `accessibilityLabel` and all other a11y props pass through `AppText` unchanged.

---

## Palette

```ts
const DEFAULT_PALETTE = [
  colors.primary,       // #4F46E5 indigo
  colors.primaryLight,  // #6366F1 indigo-light
  colors.secondary,     // #10B981 emerald
  colors.secondaryLight,// #34D399 emerald-light
  colors.primary,       // loop back
];
```

Same palette as the existing `ColourfulText` component for visual consistency.

---

## What Is NOT Changed

- `StyleSheet` definitions — all layout, size, weight, and spacing styles are untouched.
- The existing `<ColourfulText>` component — still available for per-word accent usage.
- Dark/light theme system — `ThemeContext` is unaffected.
- `<TextInput>`, `<Animated.Text>` in effects components.
