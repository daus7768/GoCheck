import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { AppText } from '../AppText';
import { colors, typography, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { GlowingCard } from '../effects/GlowingCard';
import { ForecastChart } from './ForecastChart';
import { buildInsight, forecastPeriodTotal } from '../../lib/reportsCompute';
import { formatCurrency } from '../../lib/reminderTemplates';
import type { ForecastMonth } from '../../lib/reportsCompute';
import type { Bill, Currency } from '../../types';
import type { ForecastRange } from '../../hooks/useReportsData';

interface Props {
  data: ForecastMonth[];
  currency: Currency;
  range: ForecastRange;
  onRangeChange: (r: ForecastRange) => void;
  bills?: Bill[];
}

const RANGES: { key: ForecastRange; label: string }[] = [
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '1y', label: '1Y' },
];

const RANGE_TITLES: Record<ForecastRange, string> = {
  '3m': '3-month forecast',
  '6m': '6-month forecast',
  '1y': '12-month forecast',
};

export function ForecastCard({ data, currency, range, onRangeChange, bills }: Props) {
  const { colors: c } = useTheme();
  const insight = buildInsight(data, currency, bills);
  const periodTotal = forecastPeriodTotal(data);

  return (
    <GlowingCard radius={radius['2xl']} background={c.surface}>
      <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText style={[styles.title, { color: c.textPrimary }]}>{RANGE_TITLES[range]}</AppText>
          <AppText style={[styles.sub, { color: c.textSecondary }]}>Projected outflow + recurring bills</AppText>
          {data.length > 0 && (
            <AppText style={styles.periodTotal}>
              {formatCurrency(periodTotal, currency)} total projected
            </AppText>
          )}
        </View>
        <View style={[styles.segControl, { backgroundColor: c.gray100 }]}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              style={[styles.segBtn, range === r.key && styles.segBtnActive]}
              onPress={() => onRangeChange(r.key)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <AppText style={[styles.segLabel, { color: c.textSecondary }, range === r.key && styles.segLabelActive]}>
                {r.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </View>

      <ForecastChart data={data} currency={currency} />

      {insight !== null && (
        <View style={styles.insightPill}>
          <View style={styles.insightIcon}>
            <AppText style={styles.insightIconText}>⚡</AppText>
          </View>
          <AppText style={styles.insightText}>{insight}</AppText>
        </View>
      )}
      </View>
    </GlowingCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing[3],
    gap: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  periodTotal: {
    fontFamily: typography.monoMedium,
    fontSize: 11,
    color: colors.primary,
    marginTop: 4,
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    marginTop: 2,
  },
  segControl: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    padding: 2,
    gap: 2,
  },
  segBtn: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.md,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
  },
  segLabel: {
    fontFamily: typography.sansBold,
    fontSize: 11,
  },
  segLabelActive: {
    color: '#fff',
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: radius.xl,
    padding: spacing[3],
  },
  insightIcon: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  insightIconText: {
    fontSize: 12,
  },
  insightText: {
    flex: 1,
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: '#92400e',
    lineHeight: 17,
  },
});
