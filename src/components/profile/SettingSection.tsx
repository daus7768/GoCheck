import { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { typography, fontSize, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { GlowingCard } from '../effects/GlowingCard';

interface SettingSectionProps {
  title: string;
  children: ReactNode;
  /** Optional override for the glowing accent color (defaults to theme primary). */
  accent?: string;
  /** Disable the glow effect for this section. */
  noGlow?: boolean;
}

export function SettingSection({ title, children, accent, noGlow }: SettingSectionProps) {
  const { colors: c } = useTheme();
  return (
    <View style={styles.wrap}>
      <AppText style={[styles.title, { color: c.textSecondary }]}>{title}</AppText>
      <GlowingCard radius={radius.lg} color={accent} disabled={noGlow} background={c.surface}>
        <View style={styles.body}>{children}</View>
      </GlowingCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing[5],
    marginHorizontal: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xs'],
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing[1],
    marginBottom: spacing[2],
  },
  body: {
    // Inner body — the GlowingCard provides the rounded surface.
  },
});
