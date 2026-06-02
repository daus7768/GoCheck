import React from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { colors, typography, spacing, radius } from '../../theme/tokens';
import { GlowingCard } from '../effects/GlowingCard';
import { CategoryBars } from './CategoryBars';
import type { CategoryRow } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

interface Props {
  data: CategoryRow[];
  currency: Currency;
}

export function CategoryCard({ data, currency }: Props) {
  return (
    <GlowingCard radius={radius['2xl']} background={colors.surface}>
      <View style={styles.card}>
        <AppText style={styles.title}>Spending by category</AppText>
        {data.length === 0 ? (
          <AppText style={styles.empty}>No category data yet. Add categories when creating bills.</AppText>
        ) : (
          <CategoryBars data={data} currency={currency} />
        )}
      </View>
    </GlowingCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.gray900,
    marginBottom: spacing[3],
  },
  empty: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.gray400,
    lineHeight: 18,
  },
});
