import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { typography } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
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
  const { colors: c } = useTheme();
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
        <AppText style={[styles.label, { color: c.textPrimary }]}>{CATEGORY_LABELS[row.cat]}</AppText>
      </View>
      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: c.gray100 }]}>
          <Animated.View
            style={[styles.fill, animStyle, { backgroundColor: CATEGORY_COLORS[row.cat] }]}
          />
        </View>
      </View>
      <View style={styles.amountCol}>
        <AppText style={[styles.amount, { color: c.textPrimary }]}>{formatCurrency(row.amount, currency)}</AppText>
        {row.percent !== undefined && (
          <AppText style={[styles.pct, { color: c.textSecondary }]}>{row.percent}%</AppText>
        )}
      </View>
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
  },
  trackWrap: {
    flex: 1,
  },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  amountCol: {
    width: 72,
    alignItems: 'flex-end',
  },
  amount: {
    fontFamily: typography.monoMedium,
    fontSize: 11,
  },
  pct: {
    fontFamily: typography.sansRegular,
    fontSize: 9,
    marginTop: 1,
  },
});
