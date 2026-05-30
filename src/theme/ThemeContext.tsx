import React, { createContext, useContext, useMemo } from 'react';
import { colors } from './tokens';

const darkColors = {
  ...colors,
  background: '#0A0A0F',
  surface: '#13131A',
  border: '#1F2937',
  divider: '#1A1A24',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textDisabled: '#374151',
  primarySurface: '#1E1B4B',
  primaryBorder: '#3730A3',
  secondarySurface: '#064E3B',
  errorSurface: '#450A0A',
  warningSurface: '#451A03',
} as const;

export type ThemeColors = typeof colors;

interface ThemeContextValue {
  isDark: boolean;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  colors,
});

export function ThemeProvider({
  children,
  isDark,
}: {
  children: React.ReactNode;
  isDark: boolean;
}) {
  const value = useMemo(
    () => ({ isDark, colors: isDark ? darkColors : colors }),
    [isDark]
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
