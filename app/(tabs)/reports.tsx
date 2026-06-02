import React, { useEffect, useState } from 'react';
import {
  View, ScrollView, RefreshControl, StyleSheet,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useReportsData } from '../../src/hooks/useReportsData';
import type { ForecastRange } from '../../src/hooks/useReportsData';
import { useBillStore } from '../../src/store/billStore';
import { StatCardRow } from '../../src/components/reports/StatCardRow';
import { ForecastCard } from '../../src/components/reports/ForecastCard';
import { CategoryCard } from '../../src/components/reports/CategoryCard';
import { ReliabilityCard } from '../../src/components/reports/ReliabilityCard';
import { ExportCard } from '../../src/components/reports/ExportCard';
import { ReportsSummaryStrip } from '../../src/components/reports/ReportsSummaryStrip';
import { AppText } from '../../src/components/AppText';

function SkeletonBlock({ height = 100 }: { height?: number }) {
  const { colors: c } = useTheme();
  const pulse = useSharedValue(0.4);

  pulse.value = withRepeat(
    withSequence(
      withTiming(0.85, { duration: 900 }),
      withTiming(0.4,  { duration: 900 })
    ),
    -1,
    false
  );

  const animStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={[styles.skeleton, { height, backgroundColor: c.gray100 }, animStyle]}
    />
  );
}

function EmptyState() {
  const { colors: c } = useTheme();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Feather name="bar-chart-2" size={36} color={colors.secondary} />
      </View>
      <AppText style={[styles.emptyTitle, { color: c.textPrimary }]}>No data yet</AppText>
      <AppText style={[styles.emptySub, { color: c.textSecondary }]}>
        Create your first bill to start seeing insights here.
      </AppText>
      <Pressable
        style={styles.emptyBtn}
        onPress={() => router.push('/(modals)/create')}
      >
        <AppText style={styles.emptyBtnText}>Create a bill</AppText>
      </Pressable>
    </View>
  );
}

export default function ReportsScreen() {
  const { colors: c } = useTheme();
  const insets = useSafeAreaInsets();
  const { bills } = useBillStore();
  const [forecastRange, setForecastRange] = useState<ForecastRange>('6m');

  const {
    totalCollected,
    totalOutstanding,
    outstandingCount,
    collectionRate,
    totalBills,
    activeBills,
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
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  useEffect(() => {
    if (bills.length === 0) {
      refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setLastRefreshed(new Date());
    setRefreshing(false);
  };

  if (isLoading && bills.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: c.background }]}>
        <View style={[styles.header, { backgroundColor: c.surface }]}>
          <AppText style={[styles.headerTitle, { color: c.textPrimary }]}>Reports & Insights</AppText>
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: c.background }]}>
      <View style={[styles.header, { backgroundColor: c.surface }]}>
        <AppText style={[styles.headerTitle, { color: c.textPrimary }]}>Reports & Insights</AppText>
        {lastRefreshed !== null && bills.length > 0 && (
          <AppText style={[styles.headerSub, { color: c.textSecondary }]}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </AppText>
        )}
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
            <ReportsSummaryStrip
              collectionRate={collectionRate}
              totalBills={totalBills}
              activeBills={activeBills}
            />
            <StatCardRow
              totalCollected={totalCollected}
              totalOutstanding={totalOutstanding}
              outstandingCount={outstandingCount}
              collectionRate={collectionRate}
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
  },
  header: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
  },
  headerTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
    letterSpacing: -0.5,
  },
  headerSub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize['2xs'],
    marginTop: 2,
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
    borderRadius: radius['2xl'],
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: radius.full,
    backgroundColor: colors.secondarySurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  emptyTitle: {
    fontFamily: typography.sansBold,
    fontSize: fontSize.xl,
  },
  emptySub: {
    fontFamily: typography.sansRegular,
    fontSize: fontSize.sm,
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
