# Premium UI Polish + Advanced Dark Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate every GoCheck screen to premium quality and fix the broken dark mode system, adding a Deep Void palette with smooth Reanimated-driven theme transitions and a floating animated tab bar.

**Architecture:** ThemeContext gains a `themeProgress` Reanimated shared value that drives GPU-thread background interpolation in a new `AnimatedThemeRoot` wrapper; every screen migrates from hardcoded `colors` imports to reactive `useTheme()` calls. The tab bar becomes a custom floating pill component. All 4 signature effects (TiltCard, GlareCard, ColourfulText, GradientBorderRing) are preserved exactly.

**Tech Stack:** Expo Router v3, React Native Reanimated v3, expo-blur, expo-linear-gradient, @expo/vector-icons (Feather), Zustand, existing custom effect components.

---

## File Map

| File | Change |
|---|---|
| `src/theme/ThemeContext.tsx` | Add `themeProgress` shared value, expand context type, Deep Void palette, new tokens |
| `app/_layout.tsx` | Add `AnimatedThemeRoot`, remove static `bgColor` |
| `app/(tabs)/_layout.tsx` | Full replacement — custom `FloatingTabBar` component |
| `app/(tabs)/profile.tsx` | Header gradient, profile card banner, hardcoded `colors` → `c` |
| `src/components/profile/ToggleV2.tsx` | Add glow pulse when `on === true` in dark mode |
| `app/(tabs)/index.tsx` | `useTheme()` migration, spacing polish |
| `app/(tabs)/bills.tsx` | Full `BillCard` redesign + filter strip + premium empty state |
| `app/(tabs)/reports.tsx` | Header alignment, shimmer skeleton, `useTheme()` |
| `src/components/reports/StatCardRow.tsx` | `useTheme()` migration |
| `src/components/reports/ForecastCard.tsx` | `useTheme()` migration |
| `src/components/reports/CategoryCard.tsx` | `useTheme()` migration |
| `src/components/reports/ReliabilityCard.tsx` | `useTheme()` migration |
| `src/components/reports/ExportCard.tsx` | `useTheme()` migration |
| `src/components/reports/ReportsSummaryStrip.tsx` | `useTheme()` migration |
| `src/components/dashboard/BillDetailModal.tsx` | Stats card, participant rows with GlowingCard, indigo CTA gradient |

---

## Task 1: ThemeContext — Deep Void Palette + themeProgress

**Files:**
- Modify: `src/theme/ThemeContext.tsx`

- [ ] **Step 1: Replace the entire file with the updated version**

```tsx
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import Animated, { useSharedValue, withTiming, Easing, SharedValue } from 'react-native-reanimated';
import { colors } from './tokens';

const darkColors = {
  ...colors,
  // Deep Void backgrounds
  background: '#070710',
  surface: '#0F0F18',
  // Indigo-tinted borders
  border: 'rgba(99,102,241,0.10)',
  divider: 'rgba(255,255,255,0.04)',
  // Semantic surfaces — frosted
  primarySurface: 'rgba(99,102,241,0.12)',
  primaryBorder: 'rgba(99,102,241,0.25)',
  secondarySurface: 'rgba(16,185,129,0.12)',
  errorSurface: 'rgba(239,68,68,0.12)',
  warningSurface: 'rgba(245,158,11,0.12)',
  // Text — cool-white tint
  textPrimary: '#F0F0FF',
  textSecondary: '#8B8FA8',
  textTertiary: '#6B7280',
  textDisabled: '#374151',
  // Extra surfaces used by modals and tab bar
  surface2: '#141420',
  tabBarBg: 'rgba(7,7,16,0.88)',
  // Gray overrides for dark surfaces
  gray50: '#0F0F18',
  gray100: '#1A1A28',
  gray200: '#252535',
} as const;

// Light mode gets the same extra tokens so ThemeColors stays consistent
const lightColors = {
  ...colors,
  surface2: colors.gray50,
  tabBarBg: 'rgba(255,255,255,0.92)',
} as const;

export type ThemeColors = typeof lightColors;

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
  themeProgress: SharedValue<number>;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors: lightColors,
  themeProgress: { value: 0 } as SharedValue<number>,
});

export function ThemeProvider({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  const themeProgress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    themeProgress.value = withTiming(isDark ? 1 : 0, {
      duration: 250,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isDark]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDark,
      colors: (isDark ? darkColors : lightColors) as ThemeColors,
      themeProgress,
    }),
    [isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "c:\Users\Daus\Documents\GoCheck_v2\GoCheck"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors about ThemeContext, or only pre-existing errors unrelated to this file.

- [ ] **Step 3: Commit**

```bash
git add src/theme/ThemeContext.tsx
git commit -m "feat(theme): Deep Void dark palette + themeProgress animated shared value"
```

---

## Task 2: Root Layout — AnimatedThemeRoot

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add AnimatedThemeRoot component and update RootLayout**

Open `app/_layout.tsx`. Make the following changes:

**Add these imports** (after the existing imports):
```tsx
import Animated, { useAnimatedStyle, interpolateColor } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
```

**Add this component** (before `export default function RootLayout()`):
```tsx
function AnimatedThemeRoot({ children }: { children: React.ReactNode }) {
  const { themeProgress } = useTheme();
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      [colors.background, '#070710']
    ),
  }));
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webContainer}>
        <Animated.View style={[styles.webPhone, animStyle]}>{children}</Animated.View>
      </View>
    );
  }
  return <Animated.View style={[{ flex: 1 }, animStyle]}>{children}</Animated.View>;
}
```

**In `RootLayout`**, replace the return statement's inner structure:

Find this block:
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

Replace with:
```tsx
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider isDark={isDark}>
        <ColourfulClockProvider>
          <AuthGuard>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor="transparent" />
            <AnimatedThemeRoot>{app}</AnimatedThemeRoot>
          </AuthGuard>
        </ColourfulClockProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
```

Also **remove the `bgColor` variable** (it's no longer used):
```tsx
// DELETE this line:
const bgColor = isDark ? '#0A0A0F' : colors.background;
```

- [ ] **Step 2: Start dev server and verify**

```bash
npx expo start --web
```

Open the app. Toggle dark mode from Profile screen. Verify the background smoothly fades between light and dark. No flash or jump.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(layout): AnimatedThemeRoot — GPU-animated background on theme toggle"
```

---

## Task 3: Floating Tab Bar

**Files:**
- Modify: `app/(tabs)/_layout.tsx` — full replacement

- [ ] **Step 1: Replace the entire file**

```tsx
import { Tabs } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing, radius, typography, fontSize } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { AppText } from '../../src/components/AppText';
import { haptic } from '../../src/lib/haptics';

const ROUTE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}> = {
  index:   { label: 'Home',    icon: 'home' },
  bills:   { label: 'Bills',   icon: 'file-text' },
  reports: { label: 'Reports', icon: 'bar-chart-2' },
  profile: { label: 'Profile', icon: 'user' },
};

interface TabItemProps {
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  focused: boolean;
  isDark: boolean;
  onPress: () => void;
}

function TabItem({ label, icon, focused, isDark, onPress }: TabItemProps) {
  const pillOpacity = useSharedValue(focused ? 1 : 0);
  const pillScale  = useSharedValue(focused ? 1 : 0.82);
  const iconScale  = useSharedValue(1);
  const dotOpacity = useSharedValue(focused ? 1 : 0);
  const iconOpacity = useSharedValue(focused ? 1 : 0.28);

  // React to focus changes
  Animated.useAnimatedReaction(
    () => focused,
    (isFocused) => {
      'worklet';
      pillOpacity.value = withTiming(isFocused ? 1 : 0, { duration: 200 });
      pillScale.value   = withSpring(isFocused ? 1 : 0.82, { damping: 16, stiffness: 220 });
      dotOpacity.value  = withSpring(isFocused ? 1 : 0, { damping: 16, stiffness: 200 });
      iconOpacity.value = withTiming(isFocused ? 1 : 0.28, { duration: 180 });
    }
  );

  const pillStyle = useAnimatedStyle(() => ({
    opacity: pillOpacity.value,
    transform: [{ scale: pillScale.value }],
  }));

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scaleX: dotOpacity.value }],
  }));

  function handlePress() {
    haptic.selection();
    iconScale.value = withSequence(
      withSpring(1.22, { damping: 8, stiffness: 300 }),
      withSpring(1.0,  { damping: 12, stiffness: 220 })
    );
    onPress();
  }

  const activeColor  = isDark ? '#818CF8' : colors.primary;
  const pillBgColor  = isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)';
  const pillShadow   = isDark
    ? { shadowColor: '#6366F1', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 6 }
    : { shadowColor: '#4F46E5', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 3 };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.tabItem}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
    >
      {/* Animated pill background */}
      <Animated.View style={[
        styles.pillBg,
        { backgroundColor: pillBgColor, ...(focused ? pillShadow : {}) },
        pillStyle,
      ]} />

      {/* Icon */}
      <Animated.View style={iconAnimStyle}>
        <Feather
          name={icon}
          size={20}
          color={focused ? activeColor : (isDark ? 'rgba(255,255,255,0.28)' : colors.gray400)}
          style={focused ? {
            // @ts-ignore — web drop-shadow
            filter: `drop-shadow(0 0 6px ${activeColor}88)`,
          } : undefined}
        />
      </Animated.View>

      {/* Label */}
      <AppText style={[
        styles.tabLabel,
        { color: focused ? activeColor : (isDark ? 'rgba(255,255,255,0.28)' : colors.gray400) },
      ]}>
        {label}
      </AppText>

      {/* Glow dot underline */}
      <Animated.View style={[
        styles.glowDot,
        {
          backgroundColor: activeColor,
          shadowColor: activeColor,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        },
        dotStyle,
      ]} />
    </Pressable>
  );
}

function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { isDark } = useTheme();

  return (
    <View style={[styles.tabBarOuter, { paddingBottom: insets.bottom + 8 }]}>
      <View style={[
        styles.tabBarPill,
        {
          borderColor: isDark ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.12)',
          shadowColor: '#4F46E5',
          shadowOpacity: isDark ? 0.22 : 0.12,
          shadowRadius: 28,
          shadowOffset: { width: 0, height: -4 },
          elevation: 16,
        },
      ]}>
        {/* Glassmorphic blur fill */}
        <BlurView
          intensity={isDark ? 24 : 20}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* Android fallback opaque bg (BlurView on old Android = transparent) */}
        {Platform.OS === 'android' && (
          <View style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(10,10,20,0.95)' : 'rgba(255,255,255,0.97)', borderRadius: 28 },
          ]} />
        )}
        {/* Top-edge shimmer line */}
        <LinearGradient
          colors={['transparent', 'rgba(99,102,241,0.55)', 'rgba(99,102,241,0.3)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.shimmerLine}
        />
        {/* Tab items */}
        <View style={styles.tabRow}>
          {state.routes.map((route, index) => {
            const config = ROUTE_CONFIG[route.name] ?? { label: route.name, icon: 'circle' as const };
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                label={config.label}
                icon={config.icon}
                focused={focused}
                isDark={isDark}
                onPress={() => {
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name);
                  }
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"   options={{ title: 'Home' }} />
      <Tabs.Screen name="bills"   options={{ title: 'Bills' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarOuter: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  tabBarPill: {
    borderRadius: 28,
    borderWidth: 1,
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
    position: 'relative',
  },
  shimmerLine: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    zIndex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 8,
    position: 'relative',
    zIndex: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 4,
    position: 'relative',
  },
  pillBg: {
    position: 'absolute',
    top: 0,
    left: 4,
    right: 4,
    bottom: 0,
    borderRadius: 16,
  },
  tabLabel: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize['2xs'],
    letterSpacing: 0.2,
  },
  glowDot: {
    width: 16,
    height: 2,
    borderRadius: 1,
    marginTop: 1,
  },
});
```

- [ ] **Step 2: Verify the tab bar renders**

```bash
npx expo start --web
```

Open the app. Verify:
- Tab bar is floating with rounded corners and side margins
- Active tab has a glowing pill background
- Tapping a tab triggers a spring icon bounce
- The top shimmer line is visible
- Glow dot appears under the active icon

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/_layout.tsx
git commit -m "feat(tabs): floating glassmorphic tab bar with spring-animated pill indicator"
```

---

## Task 4: Profile Screen — Header Gradient + Profile Card Banner

**Files:**
- Modify: `app/(tabs)/profile.tsx`

- [ ] **Step 1: Add LinearGradient import** (already imported but verify)

The file already imports `LinearGradient` from `expo-linear-gradient` — if not present, add:
```tsx
import { LinearGradient } from 'expo-linear-gradient';
```

- [ ] **Step 2: Replace the `header` View with a gradient-backed header**

Find:
```tsx
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[5] }]}>
        <AppText style={[styles.headerTitle, { color: c.textPrimary }]}>Profile</AppText>
      </View>
```

Replace with:
```tsx
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing[5] }]}>
        <LinearGradient
          colors={['rgba(99,102,241,0.13)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.headerAmbient} />
        <AppText style={[styles.headerTitle, { color: c.textPrimary }]}>Profile</AppText>
        <AppText style={[styles.headerSub, { color: c.textSecondary }]}>
          Manage your account & preferences
        </AppText>
      </View>
```

- [ ] **Step 3: Add the gradient banner strip to the profile card**

Find:
```tsx
        <GlowingCard radius={radius.xl} color={colors.primary} background={c.surface} innerPadding={0}>
          <View style={styles.profileCardInner}>
```

Replace with:
```tsx
        <GlowingCard radius={radius.xl} color={colors.primary} background={c.surface} innerPadding={0}>
          <LinearGradient
            colors={[colors.primary, colors.primaryLight, colors.secondary]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.profileCardBanner}
          />
          <View style={styles.profileCardInner}>
```

- [ ] **Step 4: Add avatar glow**

Find:
```tsx
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
                  <AppText style={styles.avatarInitial}>{initial}</AppText>
                </View>
              )}
```

Replace with:
```tsx
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={[styles.avatar, styles.avatarGlow]} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.primary }, styles.avatarGlow]}>
                  <AppText style={styles.avatarInitial}>{initial}</AppText>
                </View>
              )}
```

- [ ] **Step 5: Update the `organizerBadge` to add a border**

Find:
```tsx
              <View style={[styles.organizerBadge, { backgroundColor: c.primarySurface }]}>
```

Replace with:
```tsx
              <View style={[styles.organizerBadge, { backgroundColor: c.primarySurface, borderWidth: 1, borderColor: c.primaryBorder }]}>
```

- [ ] **Step 6: Add dynamic dark mode subtitle to the Dark Mode setting row**

Find:
```tsx
        <SettingRow
          label="Dark Mode"
          icon="moon"
          last
          right={
            <ToggleV2
              on={darkMode}
              onChange={(v) => setBoolPref({ darkMode: v })}
              accessibilityLabel="Toggle dark mode"
            />
          }
        />
```

Replace with:
```tsx
        <SettingRow
          label="Dark Mode"
          sub={darkMode ? 'Deep Void theme active' : 'Light mode active'}
          icon="moon"
          last
          right={
            <ToggleV2
              on={darkMode}
              onChange={(v) => setBoolPref({ darkMode: v })}
              accessibilityLabel="Toggle dark mode"
            />
          }
        />
```

- [ ] **Step 7: Add the new styles** to the `StyleSheet.create` block at the bottom:

```tsx
  headerSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    marginTop: spacing[1],
  },
  headerAmbient: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.08)',
  },
  profileCardBanner: {
    height: 5,
  },
  avatarGlow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
```

- [ ] **Step 8: Verify visually**

Run `npx expo start --web`. Open Profile. Verify:
- Subtle gradient behind "Profile" title
- Gradient banner strip (indigo → purple → emerald) at top of profile card
- Avatar has a soft indigo glow halo
- Dark Mode row shows "Deep Void theme active" / "Light mode active"

- [ ] **Step 9: Commit**

```bash
git add app/(tabs)/profile.tsx
git commit -m "feat(profile): header gradient, card banner strip, avatar glow, dynamic dark mode subtitle"
```

---

## Task 5: ToggleV2 — Glow Pulse in Dark Mode

**Files:**
- Modify: `src/components/profile/ToggleV2.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors, hitSlop } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { haptic } from '../../lib/haptics';
import { useReduceMotion } from '../../hooks/useReduceMotion';

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB = 18;
const TRAVEL = TRACK_WIDTH - THUMB - 6; // 20

interface ToggleV2Props {
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  accessibilityLabel: string;
}

export function ToggleV2({ on, onChange, disabled, accessibilityLabel }: ToggleV2Props) {
  const reduceMotion = useReduceMotion();
  const { isDark } = useTheme();

  const progress = useDerivedValue(() =>
    reduceMotion
      ? on ? 1 : 0
      : withTiming(on ? 1 : 0, { duration: 200, easing: Easing.bezier(0.4, 0, 0.2, 1) })
  );

  // Glow pulse — only runs in dark mode when toggle is ON
  const glowPulse = useDerivedValue(() => {
    if (!isDark || !on || reduceMotion) return 0;
    return withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  });

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5
      ? colors.primary
      : isDark ? 'rgba(255,255,255,0.1)' : colors.gray200,
    opacity: disabled ? 0.5 : 1,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowPulse.value * 0.7,
    shadowRadius: 12,
    elevation: Math.round(glowPulse.value * 6),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: reduceMotion
          ? on ? TRAVEL : 0
          : withSpring(on ? TRAVEL : 0, { damping: 18, stiffness: 260, mass: 0.7 }),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on, disabled: !!disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop.medium}
      disabled={disabled}
      onPress={() => {
        haptic.selection();
        onChange(!on);
      }}
    >
      <Animated.View
        style={[
          {
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            padding: 3,
            justifyContent: 'center',
          },
          trackStyle,
        ]}
      >
        <Animated.View
          style={[
            {
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: colors.white,
              shadowColor: colors.black,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25,
              shadowRadius: 3,
              elevation: 2,
            },
            thumbStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Verify visually**

In the app (dark mode on), open Profile. Toggle Dark Mode ON. Verify the toggle track has a subtle glowing indigo pulse that breathes in and out. Toggle OFF — pulse stops.

- [ ] **Step 3: Commit**

```bash
git add src/components/profile/ToggleV2.tsx
git commit -m "feat(toggle): glowing pulse animation in dark mode, track color reactive to theme"
```

---

## Task 6: Home Screen — useTheme Migration + Polish

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Add useTheme import and hook call**

Find at the top of the file:
```tsx
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
```

Add after it:
```tsx
import { useTheme } from '../../src/theme/ThemeContext';
```

At the top of `HomeScreen()` function, add:
```tsx
  const { colors: c } = useTheme();
```

- [ ] **Step 2: Migrate hardcoded `colors` references in styles**

In the `StyleSheet.create` block at the bottom, replace every `colors.xxx` reference that controls surface/background/text/border with `c.xxx`. The replacements follow this pattern. Apply ALL of these:

```tsx
// styles.container
backgroundColor: c.background    // was colors.background

// styles.billRow (inside BillRowV2 component — add useTheme there too)
// BillRowV2 is a function component, add:
//   const { colors: c } = useTheme();
// at the top of BillRowV2, then replace colors.surface with c.surface

// styles.nudgeRow background area — already uses GlowingCard which handles surface via props
// Pass background={c.surface} to all GlowingCard instances

// styles.sectionTitle
color: c.textPrimary    // was colors.textPrimary

// styles.seeAll
color: c.primary        // stays same (primary is same in both themes)

// styles.nudgeName
color: c.textPrimary

// styles.nudgeMeta
color: c.textSecondary

// styles.nudgeAmount
color: c.textPrimary

// styles.billRowTitle
color: c.textPrimary

// styles.billRowMetaText
color: c.textSecondary

// styles.billRowAmount
color: c.textPrimary

// styles.billRowCollected
color: c.textSecondary

// styles.filterPillIdle
backgroundColor: c.surface

// styles.filterBadge
backgroundColor: c.gray100

// styles.emptyTitle
color: c.textPrimary

// styles.emptySub
color: c.textSecondary
```

**IMPORTANT:** The Hero `LinearGradient` colors (`[colors.primaryLight, colors.primaryDark]`) stay hardcoded — they look correct in both modes.

- [ ] **Step 3: Update `BillRowV2` to use `useTheme()`**

Find `function BillRowV2(...)` and add `const { colors: c } = useTheme();` at the top. Then pass `background={c.surface}` to its `GlowingCard`:

```tsx
  return (
    <GlowingCard radius={radius.lg} color={glowColor} background={c.surface}>
```

- [ ] **Step 4: Polish — spacing and section titles**

In `StyleSheet.create`, update:
```tsx
  // Increase section title size
  sectionTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,  // was fontSize.sm (13) → now 15px
    color: c.textPrimary,
  },

  // More breathing room between sections
  section: {
    marginHorizontal: spacing[4],
    marginTop: spacing[5],  // was spacing[4]
  },

  // Hero gets horizontal margin so shadow isn't clipped
  heroWrap: {
    marginTop: spacing[1],
    marginBottom: spacing[1],
    marginHorizontal: spacing[4],  // ADD THIS
    ...shadow.indigoPulse,
  },
```

- [ ] **Step 5: Wrap empty state subtitle in FadeInUp**

Find:
```tsx
                <AppText style={styles.emptySub}>You're all caught up. Time to relax.</AppText>
```

Replace with:
```tsx
                <FadeInUp index={1}>
                  <AppText style={styles.emptySub}>You're all caught up. Time to relax.</AppText>
                </FadeInUp>
```

- [ ] **Step 6: Verify dark mode on Home screen**

Toggle dark mode from Profile. Return to Home. Verify:
- Background is deep void dark (#070710)
- Bill cards have dark surface (#0F0F18) backgrounds
- Text is readable in both modes
- Hero card looks unchanged (indigo gradient preserved)
- TiltCard, GlowingCard, AnimatedDonut, CountUp, DottedGlowBackground all still animate

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat(home): useTheme migration, section spacing polish, hero margin fix"
```

---

## Task 7: Bills Screen — Full Redesign

**Files:**
- Modify: `app/(tabs)/bills.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import {
  colors, typography, fontSize, spacing, radius, shadow,
} from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useBillStore } from '../../src/store/billStore';
import { useReminderStore } from '../../src/store/reminderStore';
import { buildQueueItems } from '../../src/lib/queueUtils';
import { getBillStats } from '../../src/lib/billStats';
import { useProfileStore } from '../../src/store/profileStore';
import { CURRENCY_SYMBOLS } from '../../src/types';
import type { Bill } from '../../src/types';
import { GlowingCard } from '../../src/components/effects/GlowingCard';
import { AnimatedBar } from '../../src/components/effects/AnimatedBar';
import { FadeInUp } from '../../src/components/effects/FadeInUp';
import { GradientBorderRing } from '../../src/components/effects/GradientBorderRing';
import { DottedGlowBackground } from '../../src/components/effects/DottedGlowBackground';
import { SheenButton } from '../../src/components/effects/SheenButton';
import { ColourfulText } from '../../src/components/effects/ColourfulText';
import { AnimatedTooltipStack } from '../../src/components/dashboard/AnimatedTooltipStack';
import { StatusPill } from '../../src/components/dashboard/StatusPill';
import { AppText } from '../../src/components/AppText';
import { haptic } from '../../src/lib/haptics';

type FilterId = 'active' | 'overdue' | 'recurring' | 'all';

function fmt(amount: number): string {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BillCard({ bill, index, onPress }: { bill: Bill; index: number; onPress: () => void }) {
  const { colors: c, isDark } = useTheme();
  const stats = getBillStats(bill);
  const sym = CURRENCY_SYMBOLS[bill.currency] ?? bill.currency;

  const status = stats.done
    ? 'paid'
    : stats.overdue
    ? 'overdue'
    : stats.pct >= 50
    ? 'partial'
    : 'unpaid';

  const barColor = stats.done
    ? colors.secondary
    : stats.overdue
    ? colors.error
    : stats.pct >= 50
    ? colors.warning
    : colors.primary;

  const glowColor = stats.done
    ? colors.secondary
    : stats.overdue
    ? colors.error
    : colors.primary;

  return (
    <FadeInUp index={index}>
      <GlowingCard radius={radius.xl} color={glowColor} background={c.surface}>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`Open ${bill.title}`}
        >
          {/* Top-edge highlight in dark mode */}
          {isDark && (
            <View style={styles.cardTopEdge} />
          )}

          {/* Title row */}
          <View style={styles.cardTop}>
            <View style={styles.cardTitleWrap}>
              <View style={styles.cardTitleLine}>
                <AppText style={[styles.cardTitle, { color: c.textPrimary }]} numberOfLines={1}>
                  {bill.title}
                </AppText>
                {bill.isRecurring ? (
                  <View style={[styles.recurringChip, { backgroundColor: c.primarySurface }]}>
                    <Feather name="repeat" size={9} color={colors.primary} />
                    <AppText style={styles.recurringChipText}>
                      {bill.isRecurring === 'yearly' ? 'YEARLY' : 'MONTHLY'}
                    </AppText>
                  </View>
                ) : null}
              </View>
              <View style={styles.cardMeta}>
                {stats.overdue ? (
                  <>
                    <Feather name="alert-circle" size={11} color={colors.error} />
                    <AppText style={styles.cardMetaOverdue}>
                      {Math.abs(stats.daysToDue)}d overdue · {stats.paidCount}/{stats.totalCount} paid
                    </AppText>
                  </>
                ) : (
                  <AppText style={[styles.cardMetaText, { color: c.textSecondary }]}>
                    Due {format(new Date(bill.dueDate), 'dd MMM')} · {stats.paidCount}/{stats.totalCount} paid
                  </AppText>
                )}
              </View>
            </View>
            <View style={styles.cardAmountWrap}>
              <AppText style={[styles.cardAmount, { color: c.textPrimary }]}>
                {sym}{fmt(bill.totalAmount)}
              </AppText>
              <AppText style={[styles.cardCollected, { color: c.textSecondary }]}>
                {sym}{fmt(stats.collected)} in
              </AppText>
            </View>
          </View>

          {/* Progress bar */}
          <AnimatedBar
            pct={stats.pct}
            height={4}
            trackColor={isDark ? 'rgba(255,255,255,0.06)' : colors.gray100}
            fillColor={barColor}
            duration={780}
            delay={120 + index * 60}
            style={styles.cardBar}
          />

          {/* Bottom row */}
          <View style={styles.cardBottom}>
            <AnimatedTooltipStack
              people={bill.participants}
              currency={bill.currency}
              size={22}
              max={5}
            />
            <StatusPill status={status} />
          </View>
        </Pressable>
      </GlowingCard>
    </FadeInUp>
  );
}

function EmptyState({ filter }: { filter: FilterId }) {
  const { colors: c } = useTheme();
  const messages: Record<FilterId, { title: string; colorWord: string; sub: string }> = {
    active:    { title: 'All ', colorWord: 'settled',  sub: "You're all caught up. Time to relax." },
    overdue:   { title: 'No ', colorWord: 'overdue',   sub: 'Nothing overdue — great work!' },
    recurring: { title: 'No ', colorWord: 'recurring', sub: 'Set up a recurring bill to see it here.' },
    all:       { title: 'No ', colorWord: 'bills yet', sub: 'Create your first bill to get started.' },
  };
  const { title, colorWord, sub } = messages[filter];

  return (
    <FadeInUp index={0}>
      <View style={styles.empty}>
        <View style={styles.emptyHalo}>
          <DottedGlowBackground
            gap={14}
            radius={1.4}
            opacity={0.55}
            color={colors.primary}
            glowColor={colors.primaryLight}
            focusX={0.5}
            focusY={0.5}
            speedMin={2.4}
            speedMax={5}
            maxDots={260}
          />
          <View style={[styles.emptyIconCircle, { backgroundColor: c.secondarySurface }]}>
            <Feather name="check-circle" size={36} color={colors.secondary} />
          </View>
        </View>
        <View style={styles.emptyTitleRow}>
          <AppText style={[styles.emptyTitle, { color: c.textPrimary }]}>{title}</AppText>
          <ColourfulText text={colorWord} style={[styles.emptyTitle, { color: c.textPrimary }]} />
        </View>
        <FadeInUp index={1}>
          <AppText style={[styles.emptySub, { color: c.textSecondary }]}>{sub}</AppText>
        </FadeInUp>
        <SheenButton
          onPress={() => router.push('/(modals)/create')}
          accessibilityLabel="Create new bill"
          size="sm"
          glowBorder
        >
          <Feather name="plus" size={13} color={colors.white} />
          <AppText style={styles.emptyBtnText}>Create bill</AppText>
        </SheenButton>
      </View>
    </FadeInUp>
  );
}

export default function BillsScreen() {
  const insets = useSafeAreaInsets();
  const { colors: c } = useTheme();
  const { bills, fetchBills, isLoading } = useBillStore();
  const { sent, settings } = useReminderStore();
  const sessionUserId = useProfileStore((s) => s.session?.user.id) ?? '';
  const [filter, setFilter] = useState<FilterId>('active');

  const { items: queueItems } = useMemo(
    () => buildQueueItems(bills, sent, settings, sessionUserId),
    [bills, sent, settings, sessionUserId]
  );
  const bellBadge = queueItems.length;

  useEffect(() => {
    if (!sessionUserId) return;
    fetchBills(sessionUserId);
  }, [fetchBills, sessionUserId]);

  const activeBills    = useMemo(() => bills.filter((b) => b.status === 'active' && !getBillStats(b).done), [bills]);
  const overdueBills   = useMemo(() => bills.filter((b) => getBillStats(b).overdue), [bills]);
  const recurringBills = useMemo(() => bills.filter((b) => b.isRecurring), [bills]);

  const displayBills = useMemo(() => {
    if (filter === 'overdue')   return overdueBills;
    if (filter === 'recurring') return recurringBills;
    if (filter === 'all')       return bills;
    return activeBills;
  }, [filter, bills, activeBills, overdueBills, recurringBills]);

  const filterTabs: { id: FilterId; label: string; count: number }[] = [
    { id: 'active',    label: 'Active',    count: activeBills.length },
    { id: 'overdue',   label: 'Overdue',   count: overdueBills.length },
    { id: 'recurring', label: 'Recurring', count: recurringBills.length },
    { id: 'all',       label: 'All',       count: bills.length },
  ];

  const ListHeader = useCallback(() => (
    <>
      {/* Filter strip */}
      <View style={styles.filterWrap}>
        {filterTabs.map((t) => {
          const active = t.id === filter;
          return (
            <GradientBorderRing key={t.id} thickness={1.5}>
              <Pressable
                onPress={() => { haptic.selection(); setFilter(t.id); }}
                accessibilityRole="button"
                accessibilityLabel={`${t.label} bills`}
                accessibilityState={{ selected: active }}
                style={[styles.filterPill, active ? styles.filterPillActive : { backgroundColor: c.surface }]}
              >
                <AppText style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {t.label}
                </AppText>
                <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                  <AppText style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                    {t.count}
                  </AppText>
                </View>
              </Pressable>
            </GradientBorderRing>
          );
        })}
      </View>
    </>
  ), [filter, c.surface, filterTabs]);

  if (isLoading && bills.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top }]}>
        <View style={[styles.header, { backgroundColor: c.surface }]}>
          <AppText style={[styles.title, { color: c.textPrimary }]}>My Bills</AppText>
          <ActivityIndicator color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <AppText style={[styles.title, { color: c.textPrimary }]}>My Bills</AppText>
        <View style={styles.headerActions}>
          <Pressable
            style={[styles.headerBtn, { backgroundColor: c.primarySurface, borderColor: c.primaryBorder }]}
            onPress={() => router.push('/(modals)/reminders')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Reminders"
          >
            <Feather name="bell" size={18} color={colors.primary} />
            {bellBadge > 0 && (
              <View style={styles.bellBadge}>
                <AppText style={styles.bellBadgeCount}>{bellBadge > 99 ? '99+' : bellBadge}</AppText>
              </View>
            )}
          </Pressable>
          <Pressable
            style={[styles.headerBtn, styles.headerBtnCreate]}
            onPress={() => router.push('/(modals)/create')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Create bill"
          >
            <Feather name="plus" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={displayBills}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + spacing[6] },
          displayBills.length === 0 && styles.listEmpty,
        ]}
        ListHeaderComponent={ListHeader}
        renderItem={({ item, index }) => (
          <BillCard
            bill={item}
            index={index}
            onPress={() => router.push(`/(modals)/bill/${item.id}`)}
          />
        )}
        ListEmptyComponent={<EmptyState filter={filter} />}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  headerBtn: {
    width: 36, height: 36, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  headerBtnCreate: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  bellBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: colors.error, borderRadius: radius.full,
    minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: colors.white,
  },
  bellBadgeCount: { fontFamily: typography.sansBold, fontSize: 9, color: colors.white, lineHeight: 12 },

  filterWrap: {
    flexDirection: 'row',
    gap: spacing[1.5],
    paddingVertical: spacing[3],
  },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[1.5],
    paddingHorizontal: spacing[3], paddingVertical: spacing[1.5],
    borderRadius: radius.full,
  },
  filterPillActive: { backgroundColor: colors.gray900 },
  filterPillText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs, color: colors.textSecondary },
  filterPillTextActive: { color: colors.white },
  filterBadge: {
    backgroundColor: colors.gray100, borderRadius: radius.full,
    paddingHorizontal: spacing[1.5], paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterBadgeText: { fontFamily: typography.sansMedium, fontSize: fontSize['2xs'], color: colors.textSecondary },
  filterBadgeTextActive: { color: colors.white },

  list: { paddingHorizontal: spacing[4], paddingTop: 0, gap: spacing[2.5] },
  listEmpty: { flex: 1 },

  card: { padding: spacing[3.5], gap: spacing[2.5] },
  cardTopEdge: {
    position: 'absolute', top: 0, left: 16, right: 16, height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2.5] },
  cardTitleWrap: { flex: 1, minWidth: 0 },
  cardTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing[1.5] },
  cardTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.base, flexShrink: 1 },
  recurringChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: radius.full, paddingHorizontal: spacing[1.5], paddingVertical: 1,
  },
  recurringChipText: { fontFamily: typography.sansBold, fontSize: 9, color: colors.primary, letterSpacing: 0.3 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 3 },
  cardMetaText: { fontFamily: typography.sansRegular, fontSize: fontSize.xs },
  cardMetaOverdue: { fontFamily: typography.sansMedium, fontSize: fontSize.xs, color: colors.error },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontFamily: typography.sansBold, fontSize: fontSize.base },
  cardCollected: { fontFamily: typography.monoRegular, fontSize: fontSize['2xs'], marginTop: 2 },
  cardBar: { marginVertical: spacing[1] },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  empty: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[2], flex: 1 },
  emptyHalo: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1] },
  emptyIconCircle: { width: 72, height: 72, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  emptyTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  emptyTitle: { fontFamily: typography.sansSemiBold, fontSize: fontSize.md },
  emptySub: { fontFamily: typography.sansRegular, fontSize: fontSize.sm, textAlign: 'center', maxWidth: 260 },
  emptyBtnText: { fontFamily: typography.sansSemiBold, fontSize: fontSize.xs, color: colors.white },
});
```

- [ ] **Step 2: Verify**

Open Bills tab. Verify:
- Cards use `GlowingCard` with animated glow border
- `AnimatedBar` progress bars animate in with stagger
- Filter strip uses `GradientBorderRing` (same as Home)
- `FadeInUp` stagger entrance on cards
- Empty state uses `DottedGlowBackground` + `ColourfulText` + `SheenButton`
- Dark mode surfaces are deep void

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/bills.tsx
git commit -m "feat(bills): full BillCard redesign — GlowingCard, AnimatedBar, filter strip, premium empty state"
```

---

## Task 8: Reports Screen — Header + Shimmer + useTheme

**Files:**
- Modify: `app/(tabs)/reports.tsx`

- [ ] **Step 1: Add imports**

Add at the top of `reports.tsx`:
```tsx
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/theme/ThemeContext';
```

- [ ] **Step 2: Add `useTheme()` to `ReportsScreen`**

Inside `export default function ReportsScreen()`, add at the top:
```tsx
  const { colors: c } = useTheme();
```

- [ ] **Step 3: Replace `SkeletonBlock` with animated shimmer**

Find:
```tsx
function SkeletonBlock({ height = 100 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}
```

Replace with:
```tsx
function SkeletonBlock({ height = 100 }: { height?: number }) {
  const { colors: c } = useTheme();
  const pulse = useSharedValue(0.4);

  // Start pulsing immediately
  pulse.value = withRepeat(
    withSequence(
      withTiming(0.85, { duration: 900 }),
      withTiming(0.4,  { duration: 900 })
    ),
    -1,
    false
  );

  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.skeleton, { height, backgroundColor: c.gray100 }, animStyle]}
    />
  );
}
```

- [ ] **Step 4: Fix the header — left-align, remove border, fix background**

Find:
```tsx
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.gray900,
  },
```

Replace with:
```tsx
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    letterSpacing: -0.5,
  },
```

And update the header JSX to use reactive colors:

Find:
```tsx
      <View style={[styles.header, shadow.sm]}>
        <AppText style={styles.headerTitle}>Reports & Insights</AppText>
        {lastRefreshed !== null && bills.length > 0 && (
          <AppText style={styles.headerSub}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </AppText>
        )}
      </View>
```

Replace with:
```tsx
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <AppText style={[styles.headerTitle, { color: c.textPrimary }]}>Reports & Insights</AppText>
        {lastRefreshed !== null && bills.length > 0 && (
          <AppText style={[styles.headerSub, { color: c.textSecondary }]}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </AppText>
        )}
      </View>
```

Also update the loading-state header:
```tsx
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: c.background }]}>
        <View style={[styles.header, { backgroundColor: c.surface }]}>
          <AppText style={[styles.headerTitle, { color: c.textPrimary }]}>Reports & Insights</AppText>
        </View>
```

And the main container:
```tsx
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: c.background }]}>
```

- [ ] **Step 5: Update `EmptyState` to use premium styling**

Find `function EmptyState()` and replace:
```tsx
function EmptyState() {
  const { colors: c } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Feather name="bar-chart-2" size={36} color={colors.secondary} />
      </View>
      <AppText style={[styles.emptyTitle, { color: c.textPrimary }]}>No data yet</AppText>
      <AppText style={[styles.emptySub, { color: c.textSecondary }]}>
        Create your first bill to start seeing insights here.
      </AppText>
      <Pressable
        style={styles.emptyBtn}
        onPress={() => router.push('/(modals)/create')}
      >
        <AppText style={styles.emptyBtnText}>Create a bill</AppText>
      </Pressable>
    </View>
  );
}
```

And add the `emptyIconWrap` style:
```tsx
  emptyIconWrap: {
    width: 72, height: 72, borderRadius: radius.full,
    backgroundColor: colors.secondarySurface,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing[2],
  },
```

Also update existing `emptyTitle` and `emptySub` styles to remove hardcoded colors (they'll come from inline props now).

- [ ] **Step 6: Commit**

```bash
git add app/(tabs)/reports.tsx
git commit -m "feat(reports): left-aligned header, shimmer skeleton, useTheme migration"
```

---

## Task 9: Reports Child Components — useTheme Migration

**Files:**
- Modify: `src/components/reports/StatCardRow.tsx`
- Modify: `src/components/reports/ForecastCard.tsx`
- Modify: `src/components/reports/CategoryCard.tsx`
- Modify: `src/components/reports/ReliabilityCard.tsx`
- Modify: `src/components/reports/ExportCard.tsx`
- Modify: `src/components/reports/ReportsSummaryStrip.tsx`

For each file, the migration pattern is:

1. Add import: `import { useTheme } from '../../theme/ThemeContext';`
2. Add inside the component: `const { colors: c } = useTheme();`
3. Replace: `background={colors.surface}` → `background={c.surface}` on all `GlowingCard` components
4. Replace: `color: colors.gray900` → `color: c.textPrimary`
5. Replace: `color: colors.gray700` → `color: c.textPrimary`
6. Replace: `color: colors.gray500` → `color: c.textSecondary`
7. Replace: `color: colors.gray400` → `color: c.textSecondary`
8. Replace: `backgroundColor: colors.surface` → `backgroundColor: c.surface`
9. Replace: `backgroundColor: colors.gray50` → `backgroundColor: c.surface2`
10. Replace: `backgroundColor: colors.gray100` → `backgroundColor: c.gray100` (token updated in ThemeContext)
11. Replace: `borderColor: colors.border` → `borderColor: c.border`
12. Replace: `borderColor: colors.divider` → `borderColor: c.divider`

- [ ] **Step 1: Migrate `StatCardRow.tsx`**

Open `src/components/reports/StatCardRow.tsx`. Apply the migration pattern above.

Key specific change — the `bigNumber` style:
```tsx
  bigNumber: {
    fontFamily: typography.monoMedium,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    // color is now inline: color: c.textPrimary
  },
```

And pass `color={c.textPrimary}` inline on the `AppText` for `bigNumber`:
```tsx
<AppText style={[styles.bigNumber, { color: c.textPrimary }]}>
  {formatCurrency(totalCollected, currency)}
</AppText>
```

And for `sub` and `rateSub`:
```tsx
<AppText style={[styles.sub, { color: c.textSecondary }]}>across {outstandingCount} bills</AppText>
```

For the pill backgrounds in dark mode — use semantic tokens:
```tsx
  pillUp: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    // backgroundColor: c.secondarySurface inline
  },
  pillDown: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    // backgroundColor: c.errorSurface inline
  },
```

```tsx
<View style={[styles.pillUp, { backgroundColor: c.secondarySurface }]}>
  <AppText style={[styles.pillTextUp, { color: colors.secondary }]}>
    ↗ +{trendPercent}% vs last month
  </AppText>
</View>
```

- [ ] **Step 2: Migrate remaining 5 report components**

Apply the same migration pattern to:
- `ForecastCard.tsx` — use `c.surface`, `c.textPrimary`, `c.textSecondary`, `c.border`
- `CategoryCard.tsx` — same pattern
- `ReliabilityCard.tsx` — same pattern
- `ExportCard.tsx` — same pattern
- `ReportsSummaryStrip.tsx` — same pattern

For each: add `useTheme` import + hook call, replace `colors.xxx` with `c.xxx` for surface/text/border tokens.

- [ ] **Step 3: Verify Reports dark mode**

Toggle dark mode. Open Reports tab. Verify all cards have dark surfaces, text is readable, progress bars and charts still animate correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/reports/
git commit -m "feat(reports): useTheme migration across all report components"
```

---

## Task 10: BillDetailModal — Stats Card + Participant Rows + CTA Gradient

**Files:**
- Modify: `src/components/dashboard/BillDetailModal.tsx`

- [ ] **Step 1: Add useTheme to BillDetailModal and all sub-components**

Add import:
```tsx
import { useTheme } from '../../theme/ThemeContext';
```

In `BillDetailModal` function, add:
```tsx
  const { colors: c } = useTheme();
```

In `ExpandedStats`, `ExpandedParticipants`, and `ExpandedHeader` — add `const { colors: c } = useTheme();` at the top of each.

- [ ] **Step 2: Update `ExpandedStats` — premium stats card**

Find:
```tsx
  statsCard: {
    backgroundColor: colors.gray50,
    borderRadius: radius.lg,
    padding: spacing[3.5],
  },
```

Replace with (inline in JSX):
```tsx
<View style={[styles.statsCard, { backgroundColor: c.surface2, borderColor: c.border }]}>
```

And update the style:
```tsx
  statsCard: {
    borderRadius: radius.lg,
    padding: spacing[3.5],
    borderWidth: 1,
  },
  statsLabel: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.xs,
    // color: c.textSecondary inline
  },
  statsValue: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.base,
    // color: c.textPrimary inline
    marginTop: 2,
  },
```

Apply inline colors in `ExpandedStats`:
```tsx
  <AppText style={[styles.statsLabel, { color: c.textSecondary }]}>Collected</AppText>
  <AppText style={[styles.statsValue, { color: c.textPrimary }]}>
    {sym} {fmt(stats.collected)}
  </AppText>
  // etc.
```

- [ ] **Step 3: Update participant rows to use GlowingCard**

Find in `ExpandedParticipants`:
```tsx
            <View key={p.id} style={styles.partRow}>
```

Replace with:
```tsx
            <GlowingCard
              key={p.id}
              radius={radius.lg}
              color={p.isPaid ? colors.secondary : p.avatarColor}
              background={c.surface}
            >
              <View style={styles.partRow}>
```

Close it:
```tsx
              </View>
            </GlowingCard>
```

Also remove `backgroundColor: colors.surface`, `borderWidth: 1`, `borderColor: colors.border` from `styles.partRow` (GlowingCard now provides the surface):
```tsx
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
  },
```

And update participant text colors inline:
```tsx
<AppText style={[styles.partName, { color: c.textPrimary }]}>
<AppText style={[styles.partAmount, { color: c.textPrimary }]}>
<AppText style={[styles.partAmountMeta, { color: c.textSecondary }]}>
```

- [ ] **Step 4: Replace the "Open full bill" CTA with an indigo gradient button**

Find:
```tsx
  openFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    backgroundColor: colors.gray900,
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
  },
```

Replace the `Pressable` JSX:
```tsx
                <Pressable
                  onPress={handleOpenFull}
                  accessibilityRole="button"
                  accessibilityLabel="Open full bill"
                  style={({ pressed }) => [pressed && { opacity: 0.9 }]}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.openFullBtn}
                  >
                    <AppText style={styles.openFullText}>Open full bill</AppText>
                    <Feather name="arrow-right" size={16} color={colors.white} />
                  </LinearGradient>
                </Pressable>
```

Update the style:
```tsx
  openFullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1.5],
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    marginTop: spacing[2],
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
```

Make sure `LinearGradient` is imported:
```tsx
import { LinearGradient } from 'expo-linear-gradient';
```

- [ ] **Step 5: Update sheet background and body**

Find the `sheet` style:
```tsx
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    overflow: 'hidden',
    maxHeight: '92%',
    ...shadow.lg,
  },
```

Update it to use reactive color:
```tsx
<View style={[styles.sheet, { backgroundColor: c.surface }]}>
```

- [ ] **Step 6: Verify**

Open a bill from Home, verify:
- Stats card has a dark surface with indigo border in dark mode
- Participant rows use GlowingCard with avatar-color glow
- "Open full bill" button is an indigo gradient with glow shadow
- Modal animates in/out correctly (Reanimated animations preserved)

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/BillDetailModal.tsx
git commit -m "feat(bill-modal): dark surface stats card, GlowingCard participants, indigo gradient CTA"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| themeProgress shared value in ThemeContext | Task 1 |
| Deep Void dark palette | Task 1 |
| surface2 + tabBarBg tokens | Task 1 |
| AnimatedThemeRoot GPU-animated background | Task 2 |
| Floating tab bar with spring animations | Task 3 |
| Tab bar shimmer line, glow dot, icon scale bounce | Task 3 |
| Profile header gradient | Task 4 |
| Profile card banner strip | Task 4 |
| Avatar indigo glow | Task 4 |
| Dynamic dark mode subtitle | Task 4 |
| ToggleV2 glow pulse | Task 5 |
| Home useTheme migration | Task 6 |
| Home sectionTitle size + heroWrap margin | Task 6 |
| Bills BillCard redesign with AnimatedBar | Task 7 |
| Bills filter strip with GradientBorderRing | Task 7 |
| Bills premium empty state (DottedGlow + ColourfulText + SheenButton) | Task 7 |
| Bills FadeInUp staggered entrance | Task 7 |
| Reports left-aligned header | Task 8 |
| Reports shimmer skeleton | Task 8 |
| Reports child components useTheme | Task 9 |
| BillDetailModal stats card dark surface | Task 10 |
| BillDetailModal participant GlowingCard | Task 10 |
| BillDetailModal indigo gradient CTA | Task 10 |
| TiltCard preserved | Task 6 (verified, not touched) |
| GlareCard preserved | Not touched at all |
| ColourfulText/AppText preserved | Used in Tasks 6, 7 |
| GradientBorderRing preserved | Task 7 |

All spec requirements covered. No gaps.

**Placeholder check:** No TBDs or TODOs. All steps have code.

**Type consistency:** `themeProgress: SharedValue<number>` defined in Task 1, used in Task 2. `surface2` and `tabBarBg` added to both light and dark color objects in Task 1. `c.surface2` first used in Task 10 — consistent with Task 1 definition.
