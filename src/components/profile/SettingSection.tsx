import { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';

interface SettingSectionProps {
  title: string;
  children: ReactNode;
}

export function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing[5] },
  title: {
    fontFamily: typography.sansBold,
    fontSize: fontSize['2xs'],
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: spacing[1],
    marginBottom: spacing[2],
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.md,
  },
});
