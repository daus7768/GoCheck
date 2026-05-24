import { useMemo, useCallback } from 'react';
import { useBillStore } from '../store/billStore';
import { getOrganizerId } from '../lib/organizer';
import {
  computeTrend,
  forecastMonths,
  categoryBuckets,
  topReliability,
  ForecastMonth,
  CategoryRow,
  ReliabilityResult,
} from '../lib/reportsCompute';
import type { Currency } from '../types';

export type ForecastRange = '3m' | '6m' | '1y';

export interface ReportsData {
  totalCollected: number;
  totalOutstanding: number;
  outstandingCount: number;
  trendPercent: number | null;
  trendDirection: 'up' | 'down' | null;
  forecastData: ForecastMonth[];
  categoryData: CategoryRow[];
  reliabilityData: ReliabilityResult[];
  currency: Currency;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useReportsData(forecastRange: ForecastRange = '6m'): ReportsData {
  const { bills, isLoading, fetchBills } = useBillStore();

  const refresh = useCallback(async () => {
    const id = await getOrganizerId();
    await fetchBills(id);
  }, [fetchBills]);

  const currency: Currency = (bills[0]?.currency ?? 'MYR') as Currency;

  const totalCollected = useMemo(
    () =>
      bills
        .flatMap((b) => b.participants)
        .filter((p) => p.isPaid)
        .reduce((s, p) => s + p.amount, 0),
    [bills]
  );

  const totalOutstanding = useMemo(
    () =>
      bills
        .flatMap((b) => b.participants)
        .filter((p) => !p.isPaid)
        .reduce((s, p) => s + p.amount, 0),
    [bills]
  );

  const outstandingCount = useMemo(
    () =>
      bills.filter(
        (b) => b.status === 'active' && b.participants.some((p) => !p.isPaid)
      ).length,
    [bills]
  );

  const trend = useMemo(() => computeTrend(bills), [bills]);

  const forecastData = useMemo(
    () => forecastMonths(bills, forecastRange),
    [bills, forecastRange]
  );

  const categoryData = useMemo(() => categoryBuckets(bills), [bills]);

  const reliabilityData = useMemo(() => topReliability(bills), [bills]);

  return {
    totalCollected,
    totalOutstanding,
    outstandingCount,
    trendPercent: trend?.percent ?? null,
    trendDirection: trend?.direction ?? null,
    forecastData,
    categoryData,
    reliabilityData,
    currency,
    isLoading,
    refresh,
  };
}
