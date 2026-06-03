import {
  addMonths,
  differenceInDays,
  isSameMonth,
  subMonths,
  format,
  startOfYear,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import type { Bill, BillCategory, Currency } from '../types';
import { formatCurrency } from './reminderTemplates';

export type Category = BillCategory;

export interface ForecastMonth {
  label: string;
  year: number;
  monthIndex: number;
  recurring: number;
  expected: number;
  /** True when `expected` comes from real scheduled bills (not the historical baseline). */
  hasKnownBills?: boolean;
}

export interface CategoryRow {
  cat: Category;
  amount: number;
  collected?: number;
  outstanding?: number;
  percent?: number;
}

export interface ReliabilityResult {
  name: string;
  score: number;
  avgDays: number;
  band: { label: string; color: string };
}

export interface MonthlyActual {
  label: string;
  year: number;
  monthIndex: number;
  billsCreated: number;
  totalBilled: number;
  collected: number;
  outstanding: number;
}

export interface OrganizerSummary {
  totalBills: number;
  activeBills: number;
  completedBills: number;
  cancelledBills: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  collectionRate: number;
  participantsTotal: number;
  participantsPaid: number;
  participantsUnpaid: number;
  participantsPending: number;
  participantsRejected: number;
  overdueBills: number;
  overdueAmount: number;
  recurringMonthly: number;
  recurringYearly: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function nextNMonths(n: number): { label: string; year: number; monthIndex: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = addMonths(new Date(), i + 1);
    return { label: format(d, 'MMM'), year: d.getFullYear(), monthIndex: d.getMonth() };
  });
}

export function pastNMonths(n: number): { label: string; year: number; monthIndex: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = subMonths(new Date(), n - 1 - i);
    return { label: format(d, 'MMM'), year: d.getFullYear(), monthIndex: d.getMonth() };
  });
}

// ── Section 1: Totals & trend ─────────────────────────────────────────────────

/** Paid participant amounts with payment (or bill) date in the current calendar year. */
export function computeCollectedYtd(bills: Bill[]): number {
  const yearStart = startOfYear(new Date());
  return bills
    .flatMap((b) =>
      b.participants
        .filter((p) => p.isPaid)
        .map((p) => ({ amount: p.amount, date: p.paidAt ?? b.createdAt }))
    )
    .filter(({ date }) => new Date(date) >= yearStart)
    .reduce((s, { amount }) => s + amount, 0);
}

/** Share of participant amounts marked paid (0–100). */
export function computeCollectionRate(bills: Bill[]): number {
  const participants = bills.flatMap((b) => b.participants);
  const total = participants.reduce((s, p) => s + p.amount, 0);
  if (total === 0) return 0;
  const paid = participants.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
  return Math.round((paid / total) * 100);
}

export function forecastPeriodTotal(data: ForecastMonth[]): number {
  return data.reduce((s, m) => s + m.recurring + m.expected, 0);
}

export function computeTrend(
  bills: Bill[]
): { percent: number; direction: 'up' | 'down' } | null {
  const now = new Date();

  const sumPaid = (filtered: Bill[]) =>
    filtered
      .flatMap((b) => b.participants)
      .filter((p) => p.isPaid)
      .reduce((s, p) => s + p.amount, 0);

  const current = sumPaid(bills.filter((b) => isSameMonth(new Date(b.createdAt), now)));
  const prior = sumPaid(
    bills.filter((b) => isSameMonth(new Date(b.createdAt), subMonths(now, 1)))
  );

  if (prior === 0) return null;

  const pct = Math.round(((current - prior) / prior) * 100);
  return { percent: Math.abs(pct), direction: pct >= 0 ? 'up' : 'down' };
}

/** Per-month actuals bucketed by due date for the most recent `lookback` months. */
export function monthlyActuals(bills: Bill[], lookback = 12): MonthlyActual[] {
  return pastNMonths(lookback).map((m) => {
    const monthBills = bills.filter((b) => {
      const due = new Date(b.dueDate);
      return due.getFullYear() === m.year && due.getMonth() === m.monthIndex;
    });
    let collected = 0;
    let outstanding = 0;
    let totalBilled = 0;
    for (const b of monthBills) {
      for (const p of b.participants) {
        totalBilled += p.amount;
        if (p.isPaid) collected += p.amount;
        else outstanding += p.amount;
      }
    }
    return {
      label: m.label,
      year: m.year,
      monthIndex: m.monthIndex,
      billsCreated: monthBills.length,
      totalBilled,
      collected,
      outstanding,
    };
  });
}

/** Aggregate organizer-level summary derived from current bills. */
export function organizerSummary(bills: Bill[]): OrganizerSummary {
  const all = bills.flatMap((b) => b.participants);
  const now = new Date();
  let overdueBills = 0;
  let overdueAmount = 0;
  for (const b of bills) {
    const due = new Date(b.dueDate);
    const unpaid = b.participants.filter((p) => !p.isPaid);
    if (b.status === 'active' && due < now && unpaid.length > 0) {
      overdueBills += 1;
      overdueAmount += unpaid.reduce((s, p) => s + p.amount, 0);
    }
  }
  return {
    totalBills: bills.length,
    activeBills: bills.filter((b) => b.status === 'active').length,
    completedBills: bills.filter((b) => b.status === 'complete').length,
    cancelledBills: bills.filter((b) => b.status === 'cancelled').length,
    totalBilled: all.reduce((s, p) => s + p.amount, 0),
    totalCollected: all.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0),
    totalOutstanding: all.filter((p) => !p.isPaid).reduce((s, p) => s + p.amount, 0),
    collectionRate: computeCollectionRate(bills),
    participantsTotal: all.length,
    participantsPaid: all.filter((p) => p.paymentStatus === 'confirmed' || p.isPaid).length,
    participantsUnpaid: all.filter((p) => p.paymentStatus === 'unpaid').length,
    participantsPending: all.filter((p) => p.paymentStatus === 'pending').length,
    participantsRejected: all.filter((p) => p.paymentStatus === 'rejected').length,
    overdueBills,
    overdueAmount,
    recurringMonthly: bills.filter((b) => b.isRecurring === 'monthly').length,
    recurringYearly: bills.filter((b) => b.isRecurring === 'yearly').length,
  };
}

// ── Section 2: Forecast ───────────────────────────────────────────────────────

/**
 * Build a forecast from the organizer's actual data:
 *   - `recurring` = sum of monthly recurring participant amounts (locked spend)
 *   - `expected`  = known future bills due that month (if any) OR
 *                   a weighted moving average of the last 6 months' non-recurring outflow.
 *
 * Weighted moving average uses weights 3-2-1 over the last three non-zero months
 * so recent activity dominates while still smoothing single-month spikes.
 */
export function forecastMonths(bills: Bill[], range: '3m' | '6m' | '1y'): ForecastMonth[] {
  const monthCount = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const months = nextNMonths(monthCount);

  const recurringPerMonth = bills
    .filter((b) => b.isRecurring === 'monthly')
    .flatMap((b) => b.participants)
    .reduce((s, p) => s + p.amount, 0);

  // Build historical non-recurring baseline (last 6 months, due-date bucketed).
  const history = monthlyActuals(
    bills.filter((b) => b.isRecurring !== 'monthly'),
    6
  );
  const nonZero = history.map((h) => h.totalBilled).filter((v) => v > 0);
  let baseline = 0;
  if (nonZero.length >= 3) {
    const tail = nonZero.slice(-3);
    baseline = (tail[0]! * 1 + tail[1]! * 2 + tail[2]! * 3) / 6;
  } else if (nonZero.length > 0) {
    baseline = nonZero.reduce((s, v) => s + v, 0) / nonZero.length;
  }

  // Known future bills (non-recurring, due in forecast horizon).
  const now = startOfMonth(new Date());
  const horizonEnd = endOfMonth(addMonths(now, monthCount));
  const futureKnown = new Map<string, number>();
  for (const b of bills) {
    if (b.isRecurring === 'monthly') continue;
    const due = new Date(b.dueDate);
    if (due < addMonths(now, 1) || due > horizonEnd) continue;
    const key = `${due.getFullYear()}-${due.getMonth()}`;
    const sum = b.participants.reduce((s, p) => s + p.amount, 0);
    futureKnown.set(key, (futureKnown.get(key) ?? 0) + sum);
  }

  return months.map((m) => {
    const key = `${m.year}-${m.monthIndex}`;
    const known = futureKnown.get(key);
    const expected = known !== undefined ? Math.round(known) : Math.round(baseline);
    return {
      label: m.label,
      year: m.year,
      monthIndex: m.monthIndex,
      recurring: Math.round(recurringPerMonth),
      expected,
      hasKnownBills: known !== undefined,
    };
  });
}

export function buildInsight(
  data: ForecastMonth[],
  currency: Currency,
  bills: Bill[] = []
): string | null {
  if (data.length === 0) return null;

  const totals = data.map((m) => m.recurring + m.expected);
  const maxTotal = Math.max(...totals);
  const sorted = totals.slice().sort((a, b) => a - b);
  const medTotal = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const peak = (data[totals.indexOf(maxTotal)] ?? data[0])!;
  const recurringTotal = data.reduce((s, m) => s + m.recurring, 0);
  const totalAll = totals.reduce((s, t) => s + t, 0);
  const knownMonths = data.filter((m) => m.hasKnownBills).length;

  // Overdue takes priority — it’s actionable now.
  const summary = organizerSummary(bills);
  if (summary.overdueBills > 0) {
    return `${summary.overdueBills} bill${summary.overdueBills === 1 ? '' : 's'} overdue (${formatCurrency(
      summary.overdueAmount,
      currency
    )}). Sending reminders today could shift this into the green.`;
  }

  if (totalAll === 0) {
    return `No projected spend yet. Add a recurring bill or schedule a future one to see a real forecast.`;
  }

  if (recurringTotal > 0 && recurringTotal / totalAll > 0.6) {
    return `Most of your projected spend is recurring (${formatCurrency(
      recurringTotal,
      currency
    )}). Auditing subscriptions could free up cash flow.`;
  }

  if (knownMonths === 0 && recurringTotal === 0) {
    return `Based on your last few months' average, ${peak.label} looks like the busiest at ${formatCurrency(
      maxTotal,
      currency
    )}. Schedule bills early to firm up this forecast.`;
  }

  if (maxTotal > medTotal * 1.5) {
    return `Heads up: ${peak.label} peaks at ${formatCurrency(
      maxTotal,
      currency
    )} — roughly ${Math.round((maxTotal / Math.max(medTotal, 1)) * 100 - 100)}% above your median month.`;
  }

  return `${peak.label} is your highest projected month at ${formatCurrency(maxTotal, currency)}.`;
}

// ── Section 3: Category ───────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<Category, string> = {
  travel: '#4F46E5',
  food: '#f59e0b',
  housing: '#10B981',
  sports: '#ef4444',
  events: '#a855f7',
  other: '#94a3b8',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  travel: 'Travel',
  food: 'Food & Dining',
  housing: 'Housing',
  sports: 'Sports & Fitness',
  events: 'Events',
  other: 'Other',
};

const CATEGORY_KEYS: Category[] = ['travel', 'food', 'housing', 'sports', 'events', 'other'];

export function categoryBuckets(bills: Bill[]): CategoryRow[] {
  type Bucket = { amount: number; collected: number; outstanding: number };
  const map: Record<Category, Bucket> = CATEGORY_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: { amount: 0, collected: 0, outstanding: 0 } }),
    {} as Record<Category, Bucket>
  );
  for (const bill of bills) {
    const cat = (bill.category ?? 'other') as Category;
    for (const p of bill.participants) {
      map[cat].amount += p.amount;
      if (p.isPaid) map[cat].collected += p.amount;
      else map[cat].outstanding += p.amount;
    }
  }
  const rows = (Object.entries(map) as [Category, Bucket][])
    .filter(([, b]) => b.amount > 0)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .map(([cat, b]) => ({ cat, amount: b.amount, collected: b.collected, outstanding: b.outstanding }));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return rows.map((r) => ({
    ...r,
    percent: total > 0 ? Math.round((r.amount / total) * 100) : 0,
  }));
}

// ── Section 4: Reliability ────────────────────────────────────────────────────

export function reliabilityBand(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Reliable', color: '#10B981' };
  if (score >= 70) return { label: 'On-time', color: '#4F46E5' };
  if (score >= 50) return { label: 'Slow', color: '#f59e0b' };
  return { label: 'At-risk', color: '#ef4444' };
}

export function reliabilityFor(
  name: string,
  bills: Bill[]
): { score: number; avgDays: number } | null {
  const history = bills.flatMap((b) =>
    b.participants
      .filter((p) => p.name === name && p.isPaid && p.paidAt && b.dueDate)
      .map((p) => ({
        daysLate: differenceInDays(new Date(p.paidAt!), new Date(b.dueDate)),
      }))
  );

  if (history.length === 0) return null;

  const avgDays = history.reduce((s, h) => s + h.daysLate, 0) / history.length;
  const score = Math.max(0, Math.min(100, 100 - Math.max(0, Math.round(avgDays)) * 5));
  return { score, avgDays: Math.round(avgDays) };
}

export function topReliability(bills: Bill[]): ReliabilityResult[] {
  const names = [...new Set(bills.flatMap((b) => b.participants.map((p) => p.name)))];
  return names
    .map((name) => {
      const r = reliabilityFor(name, bills);
      if (!r) return null;
      return { name, score: r.score, avgDays: r.avgDays, band: reliabilityBand(r.score) };
    })
    .filter((r): r is ReliabilityResult => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
