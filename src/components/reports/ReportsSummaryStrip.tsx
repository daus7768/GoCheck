import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { GlowingCard } from '../effects/GlowingCard';

interface Props {
  collectionRate: number;
  totalBills: number;
  activeBills: number;
}

export function ReportsSummaryStrip({
  collectionRate,
  totalBills,
  activeBills,
}: Props) {
  const { colors: c } = useTheme();
  return (
    <GlowingCard radius={radius['2xl']} background={c.surface}>
      <View style={styles.strip}>
      <View style={styles.item}>
        <View style={[styles.iconWrap, { backgroundColor: c.primarySurface }]}>
          <Feather name="percent" size={14} color={colors.primary} />
        </View>
        <View>
          <AppText style={[styles.value, { color: c.textPrimary }]}>{collectionRate}%</AppText>
          <AppText style={[styles.label, { color: c.textSecondary }]}>Collected</AppText>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: c.border }]} />
      <View style={styles.item}>
        <View style={[styles.iconWrap, { backgroundColor: c.secondarySurface }]}>
          <Feather name="file-text" size={14} color={colors.secondary} />
        </View>
        <View>
          <AppText style={[styles.value, { color: c.textPrimary }]}>{totalBills}</AppText>
          <AppText style={[styles.label, { color: c.textSecondary }]}>Total bills</AppText>
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: c.border }]} />
      <View style={styles.item}>
        <View style={[styles.iconWrap, { backgroundColor: c.warningSurface }]}>
          <Feather name="clock" size={14} color={colors.warning} />
        </View>
        <View>
          <AppText style={[styles.value, { color: c.textPrimary }]}>{activeBills}</AppText>
          <AppText style={[styles.label, { color: c.textSecondary }]}>Active</AppText>
        </View>
      </View>
      </View>
    </GlowingCard>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[2],
    alignItems: 'center',
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: typography.monoMedium,
    fontSize: 15,
    fontWeight: '700',
  },
  label: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
  },
});
