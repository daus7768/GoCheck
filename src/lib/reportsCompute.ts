import {
  addMonths,
  differenceInDays,
  isSameMonth,
  subMonths,
  format,
  startOfYear,
} from 'date-fns';
import type { Bill, Currency } from '../types';
import { formatCurrency } from './reminderTemplates';

export type Category = 'travel' | 'food' | 'housing' | 'other';

export interface ForecastMonth {
  label: string;
  year: number;
  monthIndex: number;
  recurring: number;
  expected: number;
}

export interface CategoryRow {
  cat: Category;
  amount: number;
  percent?: number;
}

export interface ReliabilityResult {
  name: string;
  score: number;
  avgDays: number;
  band: { label: string; color: string };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function nextNMonths(n: number): { label: string; year: number; monthIndex: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = addMonths(new Date(), i + 1);
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

// ── Section 2: Forecast ───────────────────────────────────────────────────────

export function forecastMonths(bills: Bill[], range: '3m' | '6m' | '1y'): ForecastMonth[] {
  const monthCount = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const months = nextNMonths(monthCount);

  const recurringPerMonth = bills
    .filter((b) => b.isRecurring === 'monthly')
    .flatMap((b) => b.participants)
    .reduce((s, p) => s + p.amount, 0);

  const allAmounts = bills.flatMap((b) => b.participants).map((p) => p.amount);
  const avgAmount = allAmounts.length
    ? allAmounts.reduce((s, a) => s + a, 0) / allAmounts.length
    : 0;

  return months.map((m, i) => ({
    label: m.label,
    year: m.year,
    monthIndex: m.monthIndex,
    recurring: recurringPerMonth,
    expected: Math.round(avgAmount * 2.4 * (1 + 0.15 * Math.sin(i * 1.1))),
  }));
}

export function buildInsight(data: ForecastMonth[], currency: Currency): string | null {
  if (data.length === 0) return null;

  const totals = data.map((m) => m.recurring + m.expected);
  const maxTotal = Math.max(...totals);
  const sorted = totals.slice().sort((a, b) => a - b);
  const medTotal = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const peak = (data[totals.indexOf(maxTotal)] ?? data[0])!;
  const recurringTotal = data.reduce((s, m) => s + m.recurring, 0);
  const totalAll = totals.reduce((s, t) => s + t, 0);

  if (recurringTotal === 0) {
    return `Based on your average monthly volume, ${peak.label} looks like the busiest month at ${formatCurrency(maxTotal, currency)}.`;
  }
  if (totalAll > 0 && recurringTotal / totalAll > 0.6) {
    return `Most of your projected spend is recurring (${formatCurrency(recurringTotal, currency)}). Consider auditing subscriptions.`;
  }
  if (maxTotal > medTotal * 1.5) {
    return `Heads up: ${peak.label} will peak at ${formatCurrency(maxTotal, currency)}. Recurring bills add ${formatCurrency(recurringTotal, currency)} over the period — consider negotiating annual rate locks now.`;
  }
  return `${peak.label} is your highest projected month at ${formatCurrency(maxTotal, currency)}.`;
}

// ── Section 3: Category ───────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<Category, string> = {
  travel: '#4F46E5',
  food: '#f59e0b',
  housing: '#10B981',
  other: '#94a3b8',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  travel: 'Travel',
  food: 'Food & Dining',
  housing: 'Housing',
  other: 'Other',
};

export function categoryBuckets(bills: Bill[]): CategoryRow[] {
  const map: Record<Category, number> = { travel: 0, food: 0, housing: 0, other: 0 };
  for (const bill of bills) {
    const cat = (bill.category ?? 'other') as Category;
    const total = bill.participants.reduce((s, p) => s + p.amount, 0);
    map[cat] = (map[cat] ?? 0) + total;
  }
  const rows = (Object.entries(map) as [Category, number][])
    .filter(([, amt]) => amt > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amount]) => ({ cat, amount }));
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
