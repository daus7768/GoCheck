import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadow } from '../../theme/tokens';
import { ForecastChart } from './ForecastChart';
import { buildInsight, forecastPeriodTotal } from '../../lib/reportsCompute';
import { formatCurrency } from '../../lib/reminderTemplates';
import type { ForecastMonth } from '../../lib/reportsCompute';
import type { Currency } from '../../types';
import type { ForecastRange } from '../../hooks/useReportsData';

interface Props {
  data: ForecastMonth[];
  currency: Currency;
  range: ForecastRange;
  onRangeChange: (r: ForecastRange) => void;
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

export function ForecastCard({ data, currency, range, onRangeChange }: Props) {
  const insight = buildInsight(data, currency);
  const periodTotal = forecastPeriodTotal(data);

  return (
    <View style={[styles.card, shadow.sm]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{RANGE_TITLES[range]}</Text>
          <Text style={styles.sub}>Projected outflow + recurring bills</Text>
          {data.length > 0 && (
            <Text style={styles.periodTotal}>
              {formatCurrency(periodTotal, currency)} total projected
            </Text>
          )}
        </View>
        <View style={styles.segControl}>
          {RANGES.map((r) => (
            <Pressable
              key={r.key}
              style={[styles.segBtn, range === r.key && styles.segBtnActive]}
              onPress={() => onRangeChange(r.key)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[styles.segLabel, range === r.key && styles.segLabelActive]}>
                {r.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ForecastChart data={data} currency={currency} />

      {insight !== null && (
        <View style={styles.insightPill}>
          <View style={styles.insightIcon}>
            <Text style={styles.insightIconText}>⚡</Text>
          </View>
          <Text style={styles.insightText}>{insight}</Text>
        </View>
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
    color: colors.gray900,
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 11,
    color: colors.gray400,
    marginTop: 2,
  },
  segControl: {
    flexDirection: 'row',
    backgroundColor: colors.gray100,
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
    color: colors.gray500,
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
