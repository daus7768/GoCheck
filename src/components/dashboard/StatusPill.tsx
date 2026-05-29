import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, fontSize, radius, spacing } from '../../theme/tokens';

type PillStatus = 'paid' | 'partial' | 'unpaid' | 'overdue';

interface StatusPillProps {
  status: PillStatus;
}

export function StatusPill({ status }: StatusPillProps) {
  const config: Record<
    PillStatus,
    { bg: string; text: string; label: string }
  > = {
    paid: {
      bg: colors.successSurface,
      text: colors.success,
      label: 'Paid',
    },
    partial: {
      bg: colors.warningSurface,
      text: colors.warning,
      label: 'Partial',
    },
    unpaid: {
      bg: colors.primarySurface,
      text: colors.primary,
      label: 'Unpaid',
    },
    overdue: {
      bg: colors.errorSurface,
      text: colors.error,
      label: 'Overdue',
    },
  };

  const { bg, text, label } = config[status];

  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderRadius: radius.full,
    paddingHorizontal: spacing[2.5],
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontFamily: typography.sansMedium,
    fontSize: fontSize.xs,
  },
});
