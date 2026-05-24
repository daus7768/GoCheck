import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useReportsData } from '../../src/hooks/useReportsData';
import type { ForecastRange } from '../../src/hooks/useReportsData';
import { useBillStore } from '../../src/store/billStore';
import { StatCardRow } from '../../src/components/reports/StatCardRow';
import { ForecastCard } from '../../src/components/reports/ForecastCard';
import { CategoryCard } from '../../src/components/reports/CategoryCard';
import { ReliabilityCard } from '../../src/components/reports/ReliabilityCard';
import { ExportCard } from '../../src/components/reports/ExportCard';

function SkeletonBlock({ height = 100 }: { height?: number }) {
  return <View style={[styles.skeleton, { height }]} />;
}

function EmptyState() {
  return (
    <View style={styles.emptyWrap}>
      <Feather name="bar-chart-2" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>No data yet</Text>
      <Text style={styles.emptySub}>
        Create your first bill to start seeing insights here.
      </Text>
      <Pressable
        style={styles.emptyBtn}
        onPress={() => router.push('/(modals)/create')}
      >
        <Text style={styles.emptyBtnText}>Create a bill</Text>
      </Pressable>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { bills } = useBillStore();
  const [forecastRange, setForecastRange] = useState<ForecastRange>('6m');

  const {
    totalCollected,
    totalOutstanding,
    outstandingCount,
    trendPercent,
    trendDirection,
    forecastData,
    categoryData,
    reliabilityData,
    currency,
    isLoading,
    refresh,
  } = useReportsData(forecastRange);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (bills.length === 0) {
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  if (isLoading && bills.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Reports & Insights</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.skeletonRow}>
            <SkeletonBlock height={88} />
            <SkeletonBlock height={88} />
          </View>
          <SkeletonBlock height={220} />
          <SkeletonBlock height={140} />
          <SkeletonBlock height={180} />
          <SkeletonBlock height={100} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={[styles.header, shadow.sm]}>
        <Text style={styles.headerTitle}>Reports & Insights</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {bills.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <StatCardRow
              totalCollected={totalCollected}
              totalOutstanding={totalOutstanding}
              outstandingCount={outstandingCount}
              trendPercent={trendPercent}
              trendDirection={trendDirection}
              currency={currency}
            />
            <ForecastCard
              data={forecastData}
              currency={currency}
              range={forecastRange}
              onRangeChange={setForecastRange}
            />
            <CategoryCard data={categoryData} currency={currency} />
            <ReliabilityCard data={reliabilityData} />
            <ExportCard bills={bills} currency={currency} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.lg,
    color: colors.gray900,
  },
  content: {
    padding: spacing[4],
    gap: 14,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  skeleton: {
    flex: 1,
    backgroundColor: colors.gray100,
    borderRadius: radius['2xl'],
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    color: colors.gray700,
  },
  emptySub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
    color: colors.gray500,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },
  emptyBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  emptyBtnText: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.sm,
    color: colors.white,
  },
});
