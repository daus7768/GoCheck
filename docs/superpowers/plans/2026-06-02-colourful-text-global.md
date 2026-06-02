# Global ColourfulText Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply per-character colour cycling to every `<Text>` element across the GoCheck app via a single global Reanimated clock so the effect is performant at scale.

**Architecture:** A `ColourfulClockProvider` holds one `useSharedValue` running once for the entire app lifetime. `AppText` replaces every native `<Text>`: it splits string children into per-character `Glyph` components that each compute their colour from the global clock plus a stagger offset — no per-character animation loops. All existing layout, font, and a11y props pass through the outer `<Text>` container unchanged.

**Tech Stack:** React Native 0.74, Expo 51, React Native Reanimated 3, TypeScript, jest-expo

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/theme/ColourfulClockContext.tsx` | Global clock shared value + provider + hook |
| Create | `src/components/AppText.tsx` | Drop-in `<Text>` replacement with colour glyphs |
| Create | `__tests__/AppText.test.tsx` | Unit tests for AppText |
| Modify | `app/_layout.tsx` | Wrap app in `ColourfulClockProvider` |
| Modify | `app/(tabs)/index.tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(tabs)/bills.tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(tabs)/reports.tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(tabs)/profile.tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(modals)/create.tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(modals)/reminders.tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(modals)/bill/[id].tsx` | `<Text>` → `<AppText>` |
| Modify | `app/(modals)/share/[code].tsx` | `<Text>` → `<AppText>` |
| Modify | `app/auth/sign-in.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/bill/BillCreatedSheet.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/bill/SuccessCheck.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/dashboard/BillDetailModal.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/dashboard/StatusPill.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/dashboard/AnimatedTooltipStack.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/common/ConfettiBurst.tsx` | `<Text>` → `<AppText>` |
| Modify | `src/components/create/*.tsx` (11 files) | `<Text>` → `<AppText>` |
| Modify | `src/components/payment/*.tsx` (5 files) | `<Text>` → `<AppText>` |
| Modify | `src/components/profile/*.tsx` (4 files) | `<Text>` → `<AppText>` |
| Modify | `src/components/reminders/*.tsx` (6 files) | `<Text>` → `<AppText>` |
| Modify | `src/components/reports/*.tsx` (8 files) | `<Text>` → `<AppText>` |

---

## Task 1: Create `ColourfulClockContext`

**Files:**
- Create: `src/theme/ColourfulClockContext.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/theme/ColourfulClockContext.tsx
import React, { createContext, useContext, useEffect } from 'react';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  SharedValue,
  cancelAnimation,
} from 'react-native-reanimated';
import { useReduceMotion } from '../hooks/useReduceMotion';

const ColourfulClockContext = createContext<SharedValue<number> | null>(null);

export function ColourfulClockProvider({ children }: { children: React.ReactNode }) {
  const clock = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(clock);
  }, [reduceMotion]);

  return (
    <ColourfulClockContext.Provider value={clock}>
      {children}
    </ColourfulClockContext.Provider>
  );
}

export function useColourClock(): SharedValue<number> {
  const clock = useContext(ColourfulClockContext);
  if (!clock) throw new Error('useColourClock must be used within ColourfulClockProvider');
  return clock;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/ColourfulClockContext.tsx
git commit -m "feat(colourful-text): add global ColourfulClockContext"
```

---

## Task 2: Write Tests for `AppText`

**Files:**
- Create: `__tests__/AppText.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// __tests__/AppText.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { AppText } from '../src/components/AppText';
import { ColourfulClockProvider } from '../src/theme/ColourfulClockContext';

function Wrapper({ children }: { children: React.ReactNode }) {
  return <ColourfulClockProvider>{children}</ColourfulClockProvider>;
}

describe('AppText', () => {
  it('renders string children as individual characters', () => {
    const { getAllByText } = render(
      <Wrapper>
        <AppText>Hi</AppText>
      </Wrapper>
    );
    expect(getAllByText('H')).toHaveLength(1);
    expect(getAllByText('i')).toHaveLength(1);
  });

  it('renders number children as string characters', () => {
    const { getAllByText } = render(
      <Wrapper>
        <AppText>{42}</AppText>
      </Wrapper>
    );
    expect(getAllByText('4')).toHaveLength(1);
    expect(getAllByText('2')).toHaveLength(1);
  });

  it('falls back to plain Text for non-string children', () => {
    const { getByText } = render(
      <Wrapper>
        <AppText><AppText>nested</AppText></AppText>
      </Wrapper>
    );
    // Outer AppText sees non-string children → falls back, inner renders
    expect(getByText('n')).toBeTruthy();
  });

  it('passes numberOfLines through to container', () => {
    const { UNSAFE_getByType } = render(
      <Wrapper>
        <AppText numberOfLines={2}>Hello</AppText>
      </Wrapper>
    );
    const { Text } = require('react-native');
    const textNode = UNSAFE_getByType(Text);
    expect(textNode.props.numberOfLines).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail (AppText doesn't exist yet)**

```bash
npx jest __tests__/AppText.test.tsx --no-coverage
```

Expected: FAIL with `Cannot find module '../src/components/AppText'`

---

## Task 3: Create `AppText` Component

**Files:**
- Create: `src/components/AppText.tsx`

- [ ] **Step 1: Create the file**

```tsx
// src/components/AppText.tsx
import React, { useMemo } from 'react';
import { Text, TextProps } from 'react-native';
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { colors } from '../theme/tokens';
import { useColourClock } from '../theme/ColourfulClockContext';

const DEFAULT_PALETTE = [
  colors.primary,       // #4F46E5 indigo
  colors.primaryLight,  // #6366F1
  colors.secondary,     // #10B981 emerald
  colors.secondaryLight,// #34D399
  colors.primary,       // loop back
];

// 90ms stagger per character expressed as fraction of the 4200ms full cycle
const STAGGER_FRACTION = 90 / 4200;

interface GlyphProps {
  char: string;
  index: number;
  palette: string[];
}

function Glyph({ char, index, palette }: GlyphProps) {
  const clock = useColourClock();
  const inputRange = useMemo(
    () => palette.map((_, i) => i / (palette.length - 1)),
    [palette]
  );
  const staggeredOffset = index * STAGGER_FRACTION;

  const animatedStyle = useAnimatedStyle(() => ({
    color: interpolateColor((clock.value + staggeredOffset) % 1, inputRange, palette),
  }));

  return <Animated.Text style={animatedStyle}>{char}</Animated.Text>;
}

interface AppTextProps extends TextProps {
  palette?: string[];
}

export function AppText({ children, palette = DEFAULT_PALETTE, ...rest }: AppTextProps) {
  const content = typeof children === 'number' ? String(children) : children;

  if (typeof content !== 'string') {
    return <Text {...rest}>{content}</Text>;
  }

  const chars = Array.from(content);

  return (
    <Text {...rest}>
      {chars.map((ch, i) => (
        <Glyph key={i} char={ch} index={i} palette={palette} />
      ))}
    </Text>
  );
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npx jest __tests__/AppText.test.tsx --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 3: Commit**

```bash
git add src/components/AppText.tsx __tests__/AppText.test.tsx
git commit -m "feat(colourful-text): add AppText component with per-character colour glyphs"
```

---

## Task 4: Wire Provider into `_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the import**

In `app/_layout.tsx`, add after line 18 (`import { ThemeProvider } ...`):

```tsx
import { ColourfulClockProvider } from '../src/theme/ColourfulClockContext';
```

- [ ] **Step 2: Wrap the app tree**

Change the return statement so `ColourfulClockProvider` wraps inside `ThemeProvider`:

```tsx
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider isDark={isDark}>
        <ColourfulClockProvider>
          <AuthGuard>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={bgColor} />
            {Platform.OS === 'web' ? (
              <View style={styles.webContainer}>
                <View style={[styles.webPhone, { backgroundColor: bgColor }]}>{app}</View>
              </View>
            ) : (
              app
            )}
          </AuthGuard>
        </ColourfulClockProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 3: Run full test suite to confirm no regressions**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(colourful-text): mount ColourfulClockProvider in root layout"
```

---

## Task 5: Migrate `app/(tabs)/` Screens

**Files:**
- Modify: `app/(tabs)/index.tsx`, `bills.tsx`, `reports.tsx`, `profile.tsx`

Apply the same two-step migration to each of the four tab screens:

**Pattern for every file in this task:**

1. Find the react-native import line. If it contains `Text`, remove `Text` from it. Add `AppText` import:
   ```tsx
   import { AppText } from '../../src/components/AppText';
   ```
2. Replace every `<Text` with `<AppText` and every `</Text>` with `</AppText>`.
   Skip any occurrences inside `src/components/effects/ColourfulText.tsx` or `CountUp.tsx` (those are not in these files anyway).

- [ ] **Step 1: Migrate `app/(tabs)/index.tsx`**

Open `app/(tabs)/index.tsx`.

Remove `Text` from the react-native import (keep `View`, `StyleSheet`, `ScrollView`, `TouchableOpacity`, `Pressable`, `Platform`, etc.).

Add after the last react-native or effects import:
```tsx
import { AppText } from '../../src/components/AppText';
```

Replace all `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX (not in strings or comments).

- [ ] **Step 2: Migrate `app/(tabs)/bills.tsx`**

Same pattern as Step 1 for `app/(tabs)/bills.tsx`.

- [ ] **Step 3: Migrate `app/(tabs)/reports.tsx`**

Same pattern as Step 1 for `app/(tabs)/reports.tsx`.

- [ ] **Step 4: Migrate `app/(tabs)/profile.tsx`**

Same pattern as Step 1 for `app/(tabs)/profile.tsx`.

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/index.tsx app/\(tabs\)/bills.tsx app/\(tabs\)/reports.tsx app/\(tabs\)/profile.tsx
git commit -m "feat(colourful-text): migrate tab screens to AppText"
```

---

## Task 6: Migrate `app/(modals)/` Screens

**Files:**
- Modify: `app/(modals)/create.tsx`, `reminders.tsx`, `bill/[id].tsx`, `share/[code].tsx`

- [ ] **Step 1: Migrate `app/(modals)/create.tsx`**

Remove `Text` from the react-native import. Add:
```tsx
import { AppText } from '../../src/components/AppText';
```
Replace all `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX.

- [ ] **Step 2: Migrate `app/(modals)/reminders.tsx`**

Same pattern for `app/(modals)/reminders.tsx`.

- [ ] **Step 3: Migrate `app/(modals)/bill/[id].tsx`**

Same pattern. Import path is one level deeper:
```tsx
import { AppText } from '../../../src/components/AppText';
```

- [ ] **Step 4: Migrate `app/(modals)/share/[code].tsx`**

Same pattern with:
```tsx
import { AppText } from '../../../src/components/AppText';
```

- [ ] **Step 5: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "app/(modals)/create.tsx" "app/(modals)/reminders.tsx" "app/(modals)/bill/[id].tsx" "app/(modals)/share/[code].tsx"
git commit -m "feat(colourful-text): migrate modal screens to AppText"
```

---

## Task 7: Migrate `app/auth/sign-in.tsx`

**Files:**
- Modify: `app/auth/sign-in.tsx`

- [ ] **Step 1: Migrate the file**

Remove `Text` from the react-native import. Add:
```tsx
import { AppText } from '../../src/components/AppText';
```
Replace all `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX.

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/auth/sign-in.tsx
git commit -m "feat(colourful-text): migrate auth sign-in to AppText"
```

---

## Task 8: Migrate `src/components/bill/` and `dashboard/` and `common/`

**Files:**
- Modify: `src/components/bill/BillCreatedSheet.tsx`
- Modify: `src/components/bill/SuccessCheck.tsx`
- Modify: `src/components/dashboard/BillDetailModal.tsx`
- Modify: `src/components/dashboard/StatusPill.tsx`
- Modify: `src/components/dashboard/AnimatedTooltipStack.tsx`
- Modify: `src/components/common/ConfettiBurst.tsx`

For all files in this task the import path is:
```tsx
import { AppText } from '../AppText';
```
(These files are at `src/components/<subdir>/`, so `'../AppText'` resolves to `src/components/AppText`.)

- [ ] **Step 1: Migrate `BillCreatedSheet.tsx`**

Remove `Text` from react-native import. Add `AppText` import (path: `'../AppText'`).
Replace `<Text` → `<AppText`, `</Text>` → `</AppText>`.

- [ ] **Step 2: Migrate `SuccessCheck.tsx`**

Same pattern with `'../AppText'`.

- [ ] **Step 3: Migrate `BillDetailModal.tsx`**

Same pattern with `'../AppText'`.

- [ ] **Step 4: Migrate `StatusPill.tsx`**

Same pattern with `'../AppText'`.

- [ ] **Step 5: Migrate `AnimatedTooltipStack.tsx`**

Same pattern with `'../AppText'`.

- [ ] **Step 6: Migrate `ConfettiBurst.tsx`**

Same pattern with `'../AppText'`.

- [ ] **Step 7: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/bill/ src/components/dashboard/ src/components/common/
git commit -m "feat(colourful-text): migrate bill, dashboard, common components to AppText"
```

---

## Task 9: Migrate `src/components/create/`

**Files:**
- Modify all `.tsx` files in `src/components/create/` that contain `<Text`:
  `CreateBillCTA.tsx`, `CurrencySelector.tsx`, `DatePickerField.tsx`, `DatePickerField.native.tsx`, `DatePickerField.web.tsx`, `LineItemRow.tsx`, `ParticipantChip.tsx`, `SplitTypeControl.tsx`, `BeamBackground.tsx`, `GlowingSection.tsx`, `AddParticipantModal.tsx`

For all: import path is `'../AppText'`.

- [ ] **Step 1: Migrate each file in `src/components/create/`**

For each file that imports `Text` from `'react-native'`:
1. Remove `Text` from the react-native import
2. Add `import { AppText } from '../AppText';`
3. Replace `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/create/
git commit -m "feat(colourful-text): migrate create components to AppText"
```

---

## Task 10: Migrate `src/components/payment/`

**Files:**
- Modify: `AISummaryBanner.tsx`, `PaymentReviewSheet.tsx`, `StatusCard.tsx`, `ProofUpload.tsx`, `SlideToConfirm.tsx`

Import path: `'../AppText'`.

- [ ] **Step 1: Migrate each file in `src/components/payment/`**

For each file that imports `Text` from `'react-native'`:
1. Remove `Text` from the react-native import
2. Add `import { AppText } from '../AppText';`
3. Replace `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/payment/
git commit -m "feat(colourful-text): migrate payment components to AppText"
```

---

## Task 11: Migrate `src/components/profile/`

**Files:**
- Modify: `ToggleV2.tsx`, `SettingRow.tsx`, `SettingSection.tsx`, `SignOutOverlay.tsx`

Import path: `'../AppText'`.

- [ ] **Step 1: Migrate each file in `src/components/profile/`**

For each file that imports `Text` from `'react-native'`:
1. Remove `Text` from the react-native import
2. Add `import { AppText } from '../AppText';`
3. Replace `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/
git commit -m "feat(colourful-text): migrate profile components to AppText"
```

---

## Task 12: Migrate `src/components/reminders/`

**Files:**
- Modify: `BatchToast.tsx`, `QueuePane.tsx`, `SentPane.tsx`, `SentRow.tsx`, `SettingsPane.tsx`, `QueueRow.tsx`

Import path: `'../AppText'`.

- [ ] **Step 1: Migrate each file in `src/components/reminders/`**

For each file that imports `Text` from `'react-native'`:
1. Remove `Text` from the react-native import
2. Add `import { AppText } from '../AppText';`
3. Replace `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/reminders/
git commit -m "feat(colourful-text): migrate reminders components to AppText"
```

---

## Task 13: Migrate `src/components/reports/`

**Files:**
- Modify: `CategoryBars.tsx`, `ForecastChart.tsx`, `ReportsSummaryStrip.tsx`, `StatCardRow.tsx`, `ForecastCard.tsx`, `CategoryCard.tsx`, `ReliabilityCard.tsx`, `ExportCard.tsx`

Import path: `'../AppText'`.

- [ ] **Step 1: Migrate each file in `src/components/reports/`**

For each file that imports `Text` from `'react-native'`:
1. Remove `Text` from the react-native import
2. Add `import { AppText } from '../AppText';`
3. Replace `<Text` → `<AppText` and `</Text>` → `</AppText>` in JSX

- [ ] **Step 2: Run the full test suite**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/reports/
git commit -m "feat(colourful-text): migrate reports components to AppText"
```

---

## Task 14: Final Verification

- [ ] **Step 1: Confirm no bare `<Text` remains in app or src (excluding effects/ and AppText itself)**

Run in PowerShell from the project root:
```powershell
Get-ChildItem -Recurse -Include "*.tsx" app, src |
  Where-Object { $_.FullName -notmatch 'effects' -and $_.Name -ne 'AppText.tsx' } |
  Select-String '<Text' |
  Where-Object { $_ -notmatch 'AppText' }
```

Expected: Zero results. If any remain, apply the migration pattern from Tasks 5–13 to those files.

- [ ] **Step 2: Run full test suite one final time**

```bash
npx jest --no-coverage
```

Expected: All tests pass.

- [ ] **Step 3: Final commit**

```bash
git commit --allow-empty -m "feat(colourful-text): global ColourfulText rollout complete"
```
