import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radius } from '../../theme/tokens';
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
  return (
    <GlowingCard radius={radius['2xl']} background={colors.surface}>
      <View style={styles.strip}>
      <View style={styles.item}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySurface }]}>
          <Feather name="percent" size={14} color={colors.primary} />
        </View>
        <View>
          <AppText style={styles.value}>{collectionRate}%</AppText>
          <AppText style={styles.label}>Collected</AppText>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <View style={[styles.iconWrap, { backgroundColor: colors.secondarySurface }]}>
          <Feather name="file-text" size={14} color={colors.secondary} />
        </View>
        <View>
          <AppText style={styles.value}>{totalBills}</AppText>
          <AppText style={styles.label}>Total bills</AppText>
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.item}>
        <View style={[styles.iconWrap, { backgroundColor: colors.warningSurface }]}>
          <Feather name="clock" size={14} color={colors.warning} />
        </View>
        <View>
          <AppText style={styles.value}>{activeBills}</AppText>
          <AppText style={styles.label}>Active</AppText>
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
    color: colors.gray900,
  },
  label: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.gray500,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 32,
    backgroundColor: colors.border,
  },
});
