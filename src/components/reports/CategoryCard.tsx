import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadow } from '../../theme/tokens';
import { CategoryBars } from './CategoryBars';
import type { CategoryRow } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

interface Props {
  data: CategoryRow[];
  currency: Currency;
}

export function CategoryCard({ data, currency }: Props) {
  return (
    <View style={[styles.card, shadow.sm]}>
      <Text style={styles.title}>Spending by category</Text>
      {data.length === 0 ? (
        <Text style={styles.empty}>No category data yet. Add categories when creating bills.</Text>
      ) : (
        <CategoryBars data={data} currency={currency} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
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
