import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useSharedValue, withTiming, Easing, SharedValue } from 'react-native-reanimated';
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

export const DARK_BACKGROUND = '#070710';

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
