import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useTheme, type ThemeColors } from '../../src/theme/ThemeContext';
import { useReportsData } from '../../src/hooks/useReportsData';
import type { ForecastRange } from '../../src/hooks/useReportsData';
import { useBillStore } from '../../src/store/billStore';
import { StatCardRow } from '../../src/components/reports/StatCardRow';
import { ForecastCard } from '../../src/components/reports/ForecastCard';
import { CategoryCard } from '../../src/components/reports/CategoryCard';
import { ReliabilityCard } from '../../src/components/reports/ReliabilityCard';
import { ExportCard } from '../../src/components/reports/ExportCard';
import { ReportsSummaryStrip } from '../../src/components/reports/ReportsSummaryStrip';

function SkeletonBlock({ height = 100 }: { height?: number }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1, backgroundColor: colors.gray100, borderRadius: radius['2xl'], height }} />;
}

function EmptyState() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.emptyWrap}>
      <Feather name="bar-chart-2" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>No data yet</Text>
      <Text style={styles.emptySub}>
        Create your first bill to start seeing insights here.
      </Text>
      <Pressable style={styles.emptyBtn} onPress={() => router.push('/(modals)/create')}>
        <Text style={styles.emptyBtnText}>Create a bill</Text>
      </Pressable>
    </View>
  );
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
        {lastRefreshed !== null && bills.length > 0 && (
          <Text style={styles.headerSub}>
            Updated {lastRefreshed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
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

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    header: {
      backgroundColor: c.surface,
      paddingHorizontal: spacing[4], paddingVertical: spacing[4],
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
      alignItems: 'center',
    },
    headerTitle: { fontFamily: typography.sansBold, fontSize: fontSize.lg, color: c.textPrimary },
    headerSub: {
      fontFamily: typography.sansRegular, fontSize: fontSize['2xs'],
      color: c.textTertiary, marginTop: 2,
    },
    content: { padding: spacing[4], gap: 14 },
    skeletonRow: { flexDirection: 'row', gap: 12 },
    emptyWrap: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      paddingTop: 80, gap: 12,
    },
    emptyTitle: { fontFamily: typography.sansBold, fontSize: fontSize.xl, color: c.textPrimary },
    emptySub: {
      fontFamily: typography.sansRegular, fontSize: fontSize.sm,
      color: c.textSecondary, textAlign: 'center', maxWidth: 260, lineHeight: 20,
    },
    emptyBtn: {
      marginTop: 8, backgroundColor: c.primary,
      borderRadius: radius.xl,
      paddingHorizontal: spacing[5], paddingVertical: spacing[3],
    },
    emptyBtnText: { fontFamily: typography.sansBold, fontSize: fontSize.sm, color: c.white },
  });
}
