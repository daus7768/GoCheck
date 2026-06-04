# Full Light / Dark Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the permanent dark cosmic background with a proper two-theme system — dark mode keeps the existing cinematic look, light mode gets a premium pearl-white background with soft emerald/teal animated beams.

**Architecture:** Create a new `LightBackgroundBeams` component (same SVG structure, pastel color palette); `_layout.tsx` conditionally renders the correct background based on `isDark`; upgrade `ThemeContext` light color tokens; fix all screens that hardcode `colors` instead of reading from `useTheme()`.

**Tech Stack:** React Native / Expo, react-native-svg, expo-linear-gradient, react-native-reanimated, Zustand (settings store), `useTheme()` hook from `src/theme/ThemeContext.tsx`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/effects/LightBackgroundBeams.tsx` | **Create** | Pearl-white base + soft pastel animated beams for light mode |
| `src/theme/ThemeContext.tsx` | **Modify** | Upgrade `lightColors` tokens to premium values |
| `app/_layout.tsx` | **Modify** | Conditional background rendering, StatusBar, nav theme, bg color |
| `app/(tabs)/index.tsx` | **Modify** | Remove `COSMIC_TEXT_*` constants, use `useTheme()` for page text |
| `app/(modals)/reminders.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |
| `src/components/reminders/QueuePane.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |
| `src/components/reminders/QueueRow.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |
| `src/components/reminders/SentPane.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |
| `src/components/reminders/SentRow.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |
| `src/components/reminders/SettingsPane.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |
| `src/components/reminders/BatchToast.tsx` | **Modify** | Switch hardcoded `colors` to `useTheme()` |

---

## Task 1: Create `LightBackgroundBeams`

**Files:**
- Create: `src/components/effects/LightBackgroundBeams.tsx`

- [ ] **Step 1: Create the file with full implementation**

```tsx
/**
 * LightBackgroundBeams — light-mode equivalent of BackgroundBeams.
 * Same 5 animated SVG bezier beams, same path geometry and timing.
 * Pearl-white base, soft emerald/teal/indigo pastel palette.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGrad, Stop, Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface BeamDef {
  id: string;
  softOpacity: number;
  softWidth: number;
  dashArray: string;
  offsetFrom: number;
  offsetTo: number;
  delay: number;
  duration: number;
}

// Same timing/geometry as dark mode — only colors differ
const BEAMS: BeamDef[] = [
  { id: 'a', softOpacity: 0.27, softWidth: 54, dashArray: '180 760', offsetFrom:  900, offsetTo: -900,  delay:    0, duration: 9000 },
  { id: 'b', softOpacity: 0.25, softWidth: 68, dashArray: '150 820', offsetFrom:  520, offsetTo: -1320, delay: 1000, duration: 8200 },
  { id: 'c', softOpacity: 0.20, softWidth: 58, dashArray: '130 780', offsetFrom: 1200, offsetTo: -760,  delay:  500, duration: 10000 },
  { id: 'd', softOpacity: 0.17, softWidth: 44, dashArray: '120 680', offsetFrom:  820, offsetTo: -1080, delay: 1800, duration: 11000 },
  { id: 'e', softOpacity: 0.14, softWidth: 50, dashArray: '160 720', offsetFrom: 1400, offsetTo: -580,  delay: 2400, duration: 8500 },
];

// Pastel emerald/teal dominant palette for light backgrounds
const GRADIENT_STOPS: Record<string, { soft: string[]; hot: string[] }> = {
  a: { soft: ['#A5B4FC', '#818CF8', '#C4B5FD', '#FFFFFF'], hot: ['#FFFFFF', '#C7D2FE', '#A5B4FC', '#C7D2FE', '#FFFFFF'] },
  b: { soft: ['#6EE7B7', '#34D399', '#A7F3D0', '#FFFFFF'], hot: ['#FFFFFF', '#D1FAE5', '#6EE7B7', '#D1FAE5', '#FFFFFF'] },
  c: { soft: ['#86EFAC', '#4ADE80', '#BBF7D0', '#FFFFFF'], hot: ['#FFFFFF', '#DCFCE7', '#86EFAC', '#DCFCE7', '#FFFFFF'] },
  d: { soft: ['#34D399', '#2DD4BF', '#99F6E4', '#FFFFFF'], hot: ['#FFFFFF', '#CCFBF1', '#5EEAD4', '#CCFBF1', '#FFFFFF'] },
  e: { soft: ['#67E8F9', '#22D3EE', '#A5F3FC', '#FFFFFF'], hot: ['#FFFFFF', '#CFFAFE', '#67E8F9', '#CFFAFE', '#FFFFFF'] },
};

function buildPaths(w: number, h: number): Record<string, string> {
  return {
    a: `M -80 ${h * 0.18} C ${w * 0.18} ${h * 0.02}, ${w * 0.36} ${h * 0.44}, ${w + 80} ${h * 0.14}`,
    b: `M -70 ${h * 0.54} C ${w * 0.22} ${h * 0.30}, ${w * 0.54} ${h * 0.76}, ${w + 80} ${h * 0.46}`,
    c: `M ${w + 70} ${h * 0.80} C ${w * 0.72} ${h * 0.58}, ${w * 0.24} ${h * 0.96}, -80 ${h * 0.66}`,
    d: `M ${w + 50} ${h * 0.08} C ${w * 0.76} ${h * 0.24}, ${w * 0.38} ${h * 0.10}, -60 ${h * 0.34}`,
    e: `M -50 ${h * 0.88} C ${w * 0.28} ${h * 0.64}, ${w * 0.72} ${h * 0.42}, ${w + 50} ${h * 0.06}`,
  };
}

interface AnimBeamProps extends BeamDef {
  d: string;
  maxOpacity: number;
}

function AnimBeam({ id, d, dashArray, offsetFrom, offsetTo, delay, duration, maxOpacity }: AnimBeamProps) {
  const progress = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) return;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false)
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, delay, duration, progress]);

  const animProps = useAnimatedProps(() => ({
    strokeDashoffset: interpolate(progress.value, [0, 1], [offsetFrom, offsetTo]),
    opacity: interpolate(
      progress.value,
      [0, 0.06, 0.84, 1],
      [0, maxOpacity, maxOpacity * 0.7, 0]
    ),
  }));

  return (
    <AnimatedPath
      d={d}
      stroke={`url(#lhot${id})`}
      strokeWidth={2.8}
      strokeLinecap="round"
      fill="none"
      strokeDasharray={dashArray}
      animatedProps={animProps}
    />
  );
}

export interface LightBackgroundBeamsProps {
  style?: StyleProp<ViewStyle>;
  opacityScale?: number;
  showBase?: boolean;
}

export function LightBackgroundBeams({
  style,
  opacityScale = 1,
  showBase = true,
}: LightBackgroundBeamsProps) {
  const [size, setSize] = useState({ w: 0, h: 0 });

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }, []);

  const paths = useMemo(() => (size.w > 0 ? buildPaths(size.w, size.h) : null), [size]);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.root, style]}
      pointerEvents="none"
      onLayout={onLayout}
    >
      {/* ── Base pearl-white gradient ── */}
      {showBase && (
        <LinearGradient
          colors={['#FAFBFF', '#F0F4FF', '#F5FFFE', '#F8FFFC']}
          locations={[0, 0.35, 0.68, 1]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── SVG beams ── */}
      {paths && (
        <Svg
          width={size.w}
          height={size.h}
          style={StyleSheet.absoluteFill}
          // @ts-ignore web-only
          pointerEvents="none"
        >
          <Defs>
            {BEAMS.map(({ id }) => {
              const stops = GRADIENT_STOPS[id]!;
              return (
                <>
                  <SvgGrad key={`lsoft${id}`} id={`lsoft${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor={stops.soft[0]!} stopOpacity="0" />
                    <Stop offset="30%"  stopColor={stops.soft[1]!} stopOpacity={String(0.3  * opacityScale)} />
                    <Stop offset="62%"  stopColor={stops.soft[2]!} stopOpacity={String(0.22 * opacityScale)} />
                    <Stop offset="100%" stopColor={stops.soft[3]!} stopOpacity="0" />
                  </SvgGrad>
                  <SvgGrad key={`lhot${id}`} id={`lhot${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%"   stopColor={stops.hot[0]!} stopOpacity="0" />
                    <Stop offset="28%"  stopColor={stops.hot[1]!} stopOpacity={String(0.75 * opacityScale)} />
                    <Stop offset="54%"  stopColor={stops.hot[2]!} stopOpacity={String(0.70 * opacityScale)} />
                    <Stop offset="76%"  stopColor={stops.hot[3]!} stopOpacity={String(0.55 * opacityScale)} />
                    <Stop offset="100%" stopColor={stops.hot[4]!} stopOpacity="0" />
                  </SvgGrad>
                </>
              );
            })}
          </Defs>

          {/* Static soft glow strokes */}
          {BEAMS.map(({ id, softOpacity, softWidth }) => (
            <Path
              key={`lglow${id}`}
              d={paths[id] ?? ''}
              stroke={`url(#lsoft${id})`}
              strokeWidth={softWidth}
              strokeLinecap="round"
              fill="none"
              opacity={softOpacity * opacityScale}
            />
          ))}

          {/* Animated bright strokes */}
          {BEAMS.map((beam) => (
            <AnimBeam
              key={`lanim${beam.id}`}
              {...beam}
              d={paths[beam.id] ?? ''}
              maxOpacity={0.55 * opacityScale}
            />
          ))}
        </Svg>
      )}

      {/* ── Light frost readability overlay ── */}
      <LinearGradient
        colors={[
          'rgba(240,244,255,0.20)',
          'rgba(240,244,255,0.10)',
          'rgba(245,255,254,0.15)',
        ]}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors in the new file

- [ ] **Step 3: Commit**

```bash
git add src/components/effects/LightBackgroundBeams.tsx
git commit -m "feat: add LightBackgroundBeams component for light theme"
```

---

## Task 2: Upgrade `ThemeContext` Light Color Tokens

**Files:**
- Modify: `src/theme/ThemeContext.tsx`

- [ ] **Step 1: Update `lightColors` definition**

In `src/theme/ThemeContext.tsx`, replace the existing `lightColors` block:

```ts
// Light mode gets the same extra tokens so ThemeColors stays consistent
const lightColors = {
  ...colors,
  surface2: colors.gray50,
  tabBarBg: 'rgba(255,255,255,0.92)',
} as const;
```

With the upgraded premium version:

```ts
// Light mode — premium pearl palette
const lightColors = {
  ...colors,
  background: '#FAFBFF',
  textPrimary: '#0F0F1A',
  textSecondary: '#4B5563',
  border: 'rgba(99,102,241,0.10)',
  divider: 'rgba(99,102,241,0.06)',
  primaryBorder: 'rgba(99,102,241,0.20)',
  surface2: '#F4F5FF',
  tabBarBg: 'rgba(250,251,255,0.95)',
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/theme/ThemeContext.tsx
git commit -m "feat: upgrade ThemeContext light color tokens to premium palette"
```

---

## Task 3: Update `_layout.tsx` for Full Theme Switching

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add imports**

At the top of `app/_layout.tsx`, add the `LightBackgroundBeams` import and `DefaultTheme` from react-navigation:

```ts
import { LightBackgroundBeams } from '../src/components/effects/LightBackgroundBeams';
import {
  ThemeProvider as NavigationThemeProvider,
  DarkTheme as NavigationDarkTheme,
  DefaultTheme as NavigationLightTheme,
} from '@react-navigation/native';
import { useTheme } from '../src/theme/ThemeContext';
```

Note: `useTheme` is already imported — only add it if not already present. `DefaultTheme` and `LightBackgroundBeams` are new.

- [ ] **Step 2: Replace `AnimatedThemeRoot`**

Replace the entire `AnimatedThemeRoot` function with this version that reads theme and switches backgrounds:

```tsx
function AnimatedThemeRoot({ children }: { children: React.ReactNode }) {
  const { isDark } = useTheme();

  const LIGHT_BG = '#FAFBFF';
  const DARK_BG  = '#070710';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const prevHtml = document.documentElement.style.backgroundColor;
    const prevBody = document.body.style.backgroundColor;
    document.documentElement.style.backgroundColor = isDark ? '#03030D' : '#F0F4FF';
    document.body.style.backgroundColor = isDark ? '#03030D' : '#F0F4FF';
    return () => {
      document.documentElement.style.backgroundColor = prevHtml;
      document.body.style.backgroundColor = prevBody;
    };
  }, [isDark]);

  const navTheme = isDark
    ? { ...NavigationDarkTheme,  colors: { ...NavigationDarkTheme.colors,  background: 'transparent', card: 'transparent' } }
    : { ...NavigationLightTheme, colors: { ...NavigationLightTheme.colors, background: 'transparent', card: 'transparent' } };

  const Background = isDark ? BackgroundBeams : LightBackgroundBeams;

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { backgroundColor: isDark ? '#03030D' : '#F0F4FF' }]}>
        <View style={[styles.webPhone, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
          <Background opacityScale={1} showBase />
          <NavigationThemeProvider value={navTheme}>
            {children}
          </NavigationThemeProvider>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.nativeRoot, { backgroundColor: isDark ? DARK_BG : LIGHT_BG }]}>
      <Background opacityScale={0.95} showBase />
      <NavigationThemeProvider value={navTheme}>
        {children}
      </NavigationThemeProvider>
    </View>
  );
}
```

- [ ] **Step 3: Switch StatusBar to theme-aware**

Find:
```tsx
<StatusBar style="light" backgroundColor="transparent" />
```

Replace with:
```tsx
<StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" />
```

Note: `isDark` is now read at the `RootLayout` level — it's already available as `const isDark = profile?.darkMode ?? false;`

- [ ] **Step 4: Remove the hardcoded `COSMIC_NAV_THEME` constant**

Delete these lines (they are no longer needed — nav theme is now built dynamically in `AnimatedThemeRoot`):
```ts
const COSMIC_NAV_THEME = {
  ...NavigationDarkTheme,
  colors: {
    ...NavigationDarkTheme.colors,
    background: 'transparent',
    card: 'transparent',
  },
};
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: switch app background and status bar based on theme"
```

---

## Task 4: Fix `index.tsx` Page-Level Text Colors

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Remove `COSMIC_TEXT_*` constants and the comment block**

Find and delete these lines (lines ~51–56):
```ts
// ── Text colours that always pop against the cosmic dark BackgroundBeams ─────
// Because the cosmic backdrop is permanent (independent of light/dark theme),
// page-level text outside opaque cards must use these fixed light tones so
// it stays readable in both theme modes.
const COSMIC_TEXT_PRIMARY = '#F0F0FF';
const COSMIC_TEXT_SECONDARY = 'rgba(240,240,255,0.62)';
```

- [ ] **Step 2: Replace all usages of `COSMIC_TEXT_PRIMARY` and `COSMIC_TEXT_SECONDARY`**

There are 4 usages. The component already has `const { colors: c } = useTheme()` via `BillRowV2` and the main component — confirm the main component function has this line (search for it). If it already does, just replace the references.

Replace:
```tsx
{ color: COSMIC_TEXT_PRIMARY }
```
With:
```tsx
{ color: c.textPrimary }
```

Replace:
```tsx
{ color: COSMIC_TEXT_SECONDARY }
```
With:
```tsx
{ color: c.textSecondary }
```

This affects 4 lines:
- `styles.sectionTitle` on "Needs a nudge" heading (line ~541)
- `styles.sectionTitle` on "Your bills" heading (line ~638)
- `styles.emptyTitle` (line ~711)
- `styles.emptySub` (line ~714)

- [ ] **Step 3: Fix `RELIABILITY_CHIP` to use theme-aware colors**

`RELIABILITY_CHIP` is defined as a module-level constant referencing `colors.*`. Move it inside the component so it reads from `useTheme()`:

Find (module-level, ~line 77):
```ts
const RELIABILITY_CHIP: Record<...> = {
  reliable: { label: 'Reliable', bg: colors.secondarySurface, text: colors.secondaryDark },
  'on-time': { label: 'On-time', bg: colors.primarySurface,   text: colors.primary },
  slow:      { label: 'Slow',    bg: colors.warningSurface,   text: colors.warning },
  'at-risk': { label: 'At risk', bg: colors.errorSurface,     text: colors.error },
  new:       { label: 'New',     bg: colors.gray100,          text: colors.textSecondary },
};
```

Remove it from module level. Inside the main page component function (where `useTheme` is already called), add:

```ts
const RELIABILITY_CHIP: Record<
  'reliable' | 'on-time' | 'slow' | 'at-risk' | 'new',
  { label: string; bg: string; text: string }
> = {
  reliable: { label: 'Reliable', bg: c.secondarySurface, text: c.secondaryDark },
  'on-time': { label: 'On-time', bg: c.primarySurface,   text: c.primary },
  slow:      { label: 'Slow',    bg: c.warningSurface,   text: c.warning },
  'at-risk': { label: 'At risk', bg: c.errorSurface,     text: c.error },
  new:       { label: 'New',     bg: c.gray100,          text: c.textSecondary },
};
```

Note: `c` is `const { colors: c } = useTheme()` — confirm this is already declared in the main component. Check for the pattern `const { colors: c } = useTheme()` in the file and add it if missing.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: replace COSMIC_TEXT constants with theme-aware colors in home screen"
```

---

## Task 5: Fix `reminders.tsx`

**Files:**
- Modify: `app/(modals)/reminders.tsx`

- [ ] **Step 1: Replace static `colors` import with `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius, animation } from '../../src/theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius, animation } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
```

- [ ] **Step 2: Add `useTheme` call inside `RemindersScreen`**

Inside the `RemindersScreen` function, after the existing hooks, add:
```ts
const { colors } = useTheme();
```

- [ ] **Step 3: Move color-dependent styles from `StyleSheet` to inline**

The `StyleSheet.create()` at the bottom of the file has several entries that reference `colors.*`. These are evaluated once at load time and won't react to theme changes. Override them with inline style objects referencing the `colors` from `useTheme()`.

In the JSX, apply these inline overrides on top of the existing stylesheet styles:

**Header `<View>`** — add inline bg and border:
```tsx
<View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
```

**Back button icon color** — change to:
```tsx
<Feather name="arrow-left" size={22} color={colors.textPrimary} />
```

**Title `AppText`** — add inline color:
```tsx
<AppText style={[styles.title, { color: colors.textPrimary }]}>Reminders</AppText>
```

**Tab bar `<View>`** — add inline bg and border:
```tsx
<View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
```

**Tab container `<View>`** — add inline bg:
```tsx
<View style={[styles.tabContainer, { backgroundColor: colors.gray100 }]} onLayout={onLayout}>
```

**Tab pill `<Animated.View>`** — add inline bg:
```tsx
<Animated.View style={[styles.tabPill, { backgroundColor: colors.surface }, pillStyle]} />
```

**Active/inactive tab labels** — update to use dynamic color:
```tsx
<AppText style={[
  styles.tabLabel,
  { color: isActive ? colors.textPrimary : colors.textSecondary },
  isActive && styles.tabLabelActive,
]}>
```

**Pane `<View>`** — add inline border color:
```tsx
<View style={[styles.pane, { borderTopColor: colors.border }]}>
```

- [ ] **Step 4: Remove color values from `StyleSheet.create()`**

In the stylesheet at the bottom, remove the `backgroundColor` and color values from entries that are now handled inline, so there's no conflict. The following style entries need their color properties removed (keep layout properties):

```ts
header: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: spacing[4],
  paddingVertical: spacing[3],
  // backgroundColor and borderBottomColor removed — handled inline
  borderBottomWidth: 1,
},
title: {
  flex: 1,
  textAlign: 'center',
  fontFamily: typography.sansBold,
  fontSize: fontSize.lg,
  // color removed — handled inline
},
tabBar: {
  // backgroundColor removed — handled inline
  paddingHorizontal: spacing[4],
  paddingBottom: spacing[3],
  borderBottomWidth: 1,
  // borderBottomColor removed — handled inline
},
tabContainer: {
  flexDirection: 'row',
  // backgroundColor removed — handled inline
  borderRadius: radius.lg,
  padding: 4,
  position: 'relative',
  height: 44,
},
tabPill: {
  position: 'absolute',
  top: 4,
  bottom: 4,
  // backgroundColor removed — handled inline
  borderRadius: radius.md,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 3,
  elevation: 2,
},
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add "app/(modals)/reminders.tsx"
git commit -m "feat: make reminders screen theme-aware"
```

---

## Task 6: Fix Reminders Components

**Files:**
- Modify: `src/components/reminders/QueuePane.tsx`
- Modify: `src/components/reminders/QueueRow.tsx`
- Modify: `src/components/reminders/SentPane.tsx`
- Modify: `src/components/reminders/SentRow.tsx`
- Modify: `src/components/reminders/SettingsPane.tsx`
- Modify: `src/components/reminders/BatchToast.tsx`

All 6 files follow the same pattern. For each file:

1. Replace `import { colors, ... }` with the non-color tokens only
2. Add `import { useTheme } from '../../theme/ThemeContext';`
3. Add `const { colors } = useTheme();` inside the component function
4. Find all `StyleSheet.create()` entries with `colors.*` values — move those color values to inline style overrides in JSX

### QueuePane.tsx

- [ ] **Step 1: Fix imports and add `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
```

Inside `QueuePane` function body, add at the top:
```ts
const { colors } = useTheme();
```

- [ ] **Step 2: Read and fix color usages**

Open the file. For every `StyleSheet.create()` entry that references `colors.*`:
- Remove the color property from the stylesheet entry
- Add an inline `{ propertyName: colors.value }` override in JSX where that style is applied

For every hardcoded color in JSX (not in a stylesheet), replace with `colors.equivalentToken`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

### QueueRow.tsx

- [ ] **Step 1: Fix imports and add `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
```

Inside `QueueRow` function body, add at the top:
```ts
const { colors } = useTheme();
```

- [ ] **Step 2: Fix color usages (same pattern as QueuePane)**

For every `StyleSheet.create()` entry referencing `colors.*`: remove color from stylesheet, add inline override.
For every hardcoded color in JSX: replace with `colors.equivalentToken`.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

### SentPane.tsx

- [ ] **Step 1: Fix imports and add `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
```

Inside `SentPane` function body, add at the top:
```ts
const { colors } = useTheme();
```

- [ ] **Step 2: Fix color usages (same pattern)**

Remove `colors.*` from `StyleSheet.create()` entries; add inline overrides in JSX.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

### SentRow.tsx

- [ ] **Step 1: Fix imports and add `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
```

Inside `SentRow` function body, add at the top:
```ts
const { colors } = useTheme();
```

- [ ] **Step 2: Fix color usages (same pattern)**

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

### SettingsPane.tsx

- [ ] **Step 1: Fix imports and add `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
```

Inside `SettingsPane` function body, add at the top:
```ts
const { colors } = useTheme();
```

- [ ] **Step 2: Fix color usages (same pattern)**

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

### BatchToast.tsx

- [ ] **Step 1: Fix imports and add `useTheme`**

Find:
```ts
import { colors, typography, fontSize, spacing, radius, animation } from '../../theme/tokens';
```

Replace with:
```ts
import { typography, fontSize, spacing, radius, animation } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
```

Inside `BatchToast` function body, add at the top:
```ts
const { colors } = useTheme();
```

- [ ] **Step 2: Fix color usages (same pattern)**

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit all 6 reminders components**

```bash
git add src/components/reminders/
git commit -m "feat: make all reminders components theme-aware"
```

---

## Task 7: Manual Verification

- [ ] **Step 1: Start the development server**

```bash
npx expo start
```

- [ ] **Step 2: Verify dark mode (default, no regression)**

With dark mode ON in Profile:
- App background is the dark cosmic void with animated bright beams ✓
- Cards are dark surfaced ✓
- Status bar icons are white/light ✓
- Tab bar is dark glassmorphic ✓
- Reminders screen has dark header/tabs ✓

- [ ] **Step 3: Toggle to light mode in Profile → Dark Mode toggle OFF**

Expected:
- App background switches to pearl-white with soft animated emerald/teal/indigo beams ✓
- "Needs a nudge" and "Your bills" section headings are dark (`#0F0F1A`), not light ✓
- "All settled" empty state text is dark, not white ✓
- Status bar icons are dark/black ✓
- Reminders screen header and tab bar are white-surfaced ✓
- Reliability chips use correct light-mode surface colors ✓

- [ ] **Step 4: Toggle back to dark mode**

Expected: full dark mode restored, no visual regression

- [ ] **Step 5: Commit verification note**

```bash
git commit --allow-empty -m "chore: light/dark theme feature verified"
```
