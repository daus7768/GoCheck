// ─── GoCheck dark teal palette (used by Create Bill and other "cinematic" surfaces) ───
export const gc = {
  primary:       '#1D9E75',
  primaryLight:  'rgba(29,158,117,0.12)',
  primaryMid:    '#0F6E56',
  primaryGlow:   'rgba(29,158,117,0.35)',
  surface:       '#0D1117',
  surface2:      '#161B22',
  surface3:      '#1C232C',
  border:        'rgba(255,255,255,0.08)',
  borderEm:      'rgba(29,158,117,0.35)',
  text:          '#F0F6FC',
  muted:         '#8B949E',
  hint:          '#484F58',
  danger:        '#E24B4A',
  dangerSurface: 'rgba(226,75,74,0.10)',
  amber:         '#EF9F27',
  amberSurface:  'rgba(239,159,39,0.12)',
  white:         '#FFFFFF',
} as const;

export const colors = {
  // Primary — Indigo 600
  primary: '#4F46E5',
  primaryDark: '#4338CA',
  primaryLight: '#6366F1',
  primarySurface: '#EEF2FF',
  primaryBorder: '#C7D2FE',

  // Secondary — Emerald
  secondary: '#10B981',
  secondaryDark: '#059669',
  secondaryLight: '#34D399',
  secondarySurface: '#ECFDF5',
  secondaryBorder: '#A7F3D0',

  // Semantic
  error: '#EF4444',
  errorDark: '#DC2626',
  errorSurface: '#FEF2F2',
  errorBorder: '#FECACA',
  warning: '#F59E0B',
  warningSurface: '#FFFBEB',
  warningBorder: '#FDE68A',
  success: '#10B981',
  successSurface: '#ECFDF5',

  // Neutrals
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  // App surfaces
  background: '#F8F9FF',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderFocus: '#4F46E5',
  borderError: '#EF4444',
  divider: '#F3F4F6',

  // Text
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textDisabled: '#D1D5DB',
  textInverse: '#FFFFFF',
  textAccent: '#4F46E5',

  // Utility
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',

  // Avatar palette (for participant initials)
  avatar: [
    '#4F46E5', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  ],
} as const;

export const typography = {
  sansRegular: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  sansSemiBold: 'DMSans_700Bold',
  sansBold: 'DMSans_700Bold',
  monoRegular: 'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

export const fontSize = {
  '2xs': 10,
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 28,
  '3xl': 34,
  '4xl': 40,
  '5xl': 48,
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const;

export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

export const shadow = {
  none: {},
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 8,
  },
  indigoPulse: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const animation = {
  springSnappy: { damping: 20, stiffness: 300, mass: 0.8 },
  springBouncy: { damping: 15, stiffness: 200, mass: 1 },
  springGentle: { damping: 25, stiffness: 150, mass: 1 },
  durationFast: 150,
  durationNormal: 250,
  durationSlow: 400,
} as const;

export const hitSlop = {
  small: { top: 8, bottom: 8, left: 8, right: 8 },
  medium: { top: 12, bottom: 12, left: 12, right: 12 },
  large: { top: 16, bottom: 16, left: 16, right: 16 },
} as const;
