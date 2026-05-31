import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, fontSize, spacing, radius } from '../../theme/tokens';
import { formatCurrency } from '../../lib/reminderTemplates';
import { GlowingCard } from '../effects/GlowingCard';
import type { Currency } from '../../types';

interface Props {
  totalCollected: number;
  totalOutstanding: number;
  outstandingCount: number;
  collectionRate: number;
  trendPercent: number | null;
  trendDirection: 'up' | 'down' | null;
  currency: Currency;
}

export function StatCardRow({
  totalCollected,
  totalOutstanding,
  outstandingCount,
  collectionRate,
  trendPercent,
  trendDirection,
  currency,
}: Props) {
  return (
    <View style={styles.row}>
      {/* Card A — Collected */}
      <View style={styles.cardSlot}>
        <GlowingCard radius={radius['2xl']} color="#16a34a" background={colors.surface}>
          <View style={styles.cardBody}>
            <Text style={styles.eyebrowGreen}>COLLECTED (YTD)</Text>
            <Text style={styles.bigNumber}>{formatCurrency(totalCollected, currency)}</Text>
            <View style={styles.metaRow}>
              {trendDirection !== null && trendPercent !== null ? (
                <View style={trendDirection === 'up' ? styles.pillUp : styles.pillDown}>
                  <Text style={trendDirection === 'up' ? styles.pillTextUp : styles.pillTextDown}>
                    {trendDirection === 'up' ? '↗' : '↘'} {trendDirection === 'up' ? '+' : '−'}
                    {trendPercent}% vs last month
                  </Text>
                </View>
              ) : (
                <Text style={styles.rateSub}>{collectionRate}% collection rate</Text>
              )}
            </View>
          </View>
        </GlowingCard>
      </View>

      {/* Card B — Outstanding */}
      <View style={styles.cardSlot}>
        <GlowingCard radius={radius['2xl']} color="#d97706" background={colors.surface}>
          <View style={styles.cardBody}>
            <Text style={styles.eyebrowAmber}>OUTSTANDING</Text>
            <Text style={styles.bigNumber}>{formatCurrency(totalOutstanding, currency)}</Text>
            <Text style={styles.sub}>across {outstandingCount} bills</Text>
          </View>
        </GlowingCard>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  cardSlot: {
    flex: 1,
  },
  cardBody: {
    padding: spacing[4] - 2,
  },
  eyebrowGreen: {
    fontFamily: typography.sansBold,
    fontSize: 9,
    letterSpacing: 0.08 * 9,
    textTransform: 'uppercase',
    color: '#15803d',
    marginBottom: 4,
  },
  eyebrowAmber: {
    fontFamily: typography.sansBold,
    fontSize: 9,
    letterSpacing: 0.08 * 9,
    textTransform: 'uppercase',
    color: '#d97706',
    marginBottom: 4,
  },
  bigNumber: {
    fontFamily: typography.monoMedium,
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 6,
  },
  pillUp: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillDown: {
    alignSelf: 'flex-start',
    backgroundColor: '#fee2e2',
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillTextUp: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: '#16a34a',
  },
  pillTextDown: {
    fontFamily: typography.sansBold,
    fontSize: 10,
    color: '#dc2626',
  },
  sub: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.gray500,
    marginTop: 4,
  },
  metaRow: {
    minHeight: 20,
    justifyContent: 'center',
  },
  rateSub: {
    fontFamily: typography.sansRegular,
    fontSize: 10,
    color: colors.gray500,
  },
});
