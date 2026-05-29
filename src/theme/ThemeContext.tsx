import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';

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
