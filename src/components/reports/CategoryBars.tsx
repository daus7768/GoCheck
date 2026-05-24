import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '../../theme/tokens';
import { formatCurrency } from '../../lib/reminderTemplates';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/reportsCompute';
import type { CategoryRow } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

interface BarRowProps {
  row: CategoryRow;
  maxAmount: number;
  currency: Currency;
}

function BarRow({ row, maxAmount, currency }: BarRowProps) {
  const widthProgress = useSharedValue(0);
  const targetWidth = maxAmount > 0 ? row.amount / maxAmount : 0;

  useEffect(() => {
    widthProgress.value = 0;
    widthProgress.value = withTiming(targetWidth, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [row.amount, maxAmount]);

  const animStyle = useAnimatedStyle(() => ({
    width: `${widthProgress.value * 100}%`,
  }));

  return (
    <View style={styles.row}>
      <View style={styles.labelGroup}>
        <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[row.cat] }]} />
        <Text style={styles.label}>{CATEGORY_LABELS[row.cat]}</Text>
      </View>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, animStyle, { backgroundColor: CATEGORY_COLORS[row.cat] }]}
          />
        </View>
      </View>
      <Text style={styles.amount}>{formatCurrency(row.amount, currency)}</Text>
    </View>
  );
}

interface Props {
  data: CategoryRow[];
  currency: Currency;
}

export function CategoryBars({ data, currency }: Props) {
  const maxAmount = data.length > 0 ? data[0]!.amount : 0;
  return (
    <View style={styles.container}>
      {data.map((row) => (
        <BarRow key={row.cat} row={row} maxAmount={maxAmount} currency={currency} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 90,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    flexShrink: 0,
  },
  label: {
    fontFamily: typography.sansRegular,
    fontSize: 12,
    color: colors.gray700,
  },
  trackWrap: {
    flex: 1,
  },
  track: {
    height: 7,
    backgroundColor: colors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  amount: {
    fontFamily: typography.monoMedium,
    fontSize: 11,
    color: colors.gray900,
    width: 64,
    textAlign: 'right',
  },
});
