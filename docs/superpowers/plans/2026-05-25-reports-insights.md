# Reports & Insights Tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Activity tab with a fully-functional Reports & Insights screen covering 5 sections: stat cards, 6-month forecast chart, spending by category, reliability ranking, and CSV/PDF export.

**Architecture:** All data is derived client-side from the existing `bills` + `participants` data already loaded in `useBillStore`. A single `useReportsData` hook wraps all computation via `useMemo`. Charts are built with `react-native-svg` (already installed). Animations use `react-native-reanimated` (already installed).

**Tech Stack:** Expo SDK 51, React Native, TypeScript, Zustand, react-native-svg v15, react-native-reanimated v3, date-fns v3, expo-file-system, expo-sharing, expo-print (install last three), Supabase (adds 2 columns to `bills` table).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `supabase/migrations/003_reports_columns.sql` | Adds `category`, `is_recurring` to bills |
| Modify | `src/types/index.ts` | Add `category`, `isRecurring` to Bill; add `category` to CreateBillArgs |
| Modify | `src/lib/supabase.ts` | Add `category`, `is_recurring` to `createBillInDB` payload |
| Modify | `src/store/billStore.ts` | Map `category`, `is_recurring` in `fetchBills` and `createBill` |
| Create | `src/lib/reportsCompute.ts` | Pure functions: computeTrend, forecastMonths, categoryBuckets, reliabilityFor, reliabilityBand, buildInsight |
| Create | `__tests__/reportsCompute.test.ts` | Tests for all pure functions |
| Create | `src/hooks/useReportsData.ts` | Memoised hook that exposes all derived data |
| Create | `src/components/reports/StatCardRow.tsx` | Section 1: two stat cards |
| Create | `src/components/reports/ForecastChart.tsx` | SVG stacked bar chart with animation + tap tooltip |
| Create | `src/components/reports/ForecastCard.tsx` | Section 2: range picker + chart + insight pill |
| Create | `src/components/reports/CategoryBars.tsx` | Animated horizontal bars |
| Create | `src/components/reports/CategoryCard.tsx` | Section 3: spending by category |
| Create | `src/components/reports/ReliabilityCard.tsx` | Section 4: who pays on time |
| Create | `src/lib/exportCsv.ts` | CSV generator + native share |
| Create | `src/lib/exportPdf.ts` | PDF HTML builder + native share |
| Create | `src/components/reports/ExportCard.tsx` | Section 5: CSV + PDF buttons |
| Create | `app/(tabs)/reports.tsx` | Screen shell: header, scroll, skeleton, empty state, pull-to-refresh |
| Modify | `app/(tabs)/_layout.tsx` | Rename activity → reports, update icon + title |
| Modify | `app/(modals)/create.tsx` | Add category state + 4-chip picker UI |

---

## Task 1: Install Packages + Schema Migration

**Files:**
- Create: `supabase/migrations/003_reports_columns.sql`

- [ ] **Step 1.1 — Install the three new Expo packages**

Run from the project root:
```bash
npx expo install expo-file-system expo-sharing expo-print
```
Expected output: packages added to `package.json` and `node_modules`.

- [ ] **Step 1.2 — Create the migration file**

Create `supabase/migrations/003_reports_columns.sql`:
```sql
-- Add category and is_recurring to bills table
alter table bills
  add column if not exists category text
    default 'other'
    check (category in ('travel', 'food', 'housing', 'other')),
  add column if not exists is_recurring text
    check (is_recurring in ('monthly', 'yearly') or is_recurring is null);
```

- [ ] **Step 1.3 — Apply migration to Supabase**

Run in Supabase SQL editor (dashboard → SQL editor) or via CLI:
```bash
supabase db push
```
Verify by checking the `bills` table has both new columns with the correct constraints.

- [ ] **Step 1.4 — Commit**

```bash
git add supabase/migrations/003_reports_columns.sql package.json package-lock.json
git commit -m "feat: install export packages and add category/is_recurring migration"
```

---

## Task 2: Update Types + Supabase Layer + Bill Store Mapping

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/supabase.ts`
- Modify: `src/store/billStore.ts`

- [ ] **Step 2.1 — Add fields to the `Bill` interface in `src/types/index.ts`**

Find the `Bill` interface (around line 42). Add two optional fields after `shareLink`:
```ts
export interface Bill {
  id: string;
  organizerId: string;
  title: string;
  description?: string;
  totalAmount: number;
  currency: Currency;
  dueDate: string;
  status: BillStatus;
  shareLink: string;
  category?: 'travel' | 'food' | 'housing' | 'other';   // ADD
  isRecurring?: 'monthly' | 'yearly' | null;             // ADD
  participants: Participant[];
  lineItems?: LineItemComputed[];
  taxRate?: number;
  groupPhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2.2 — Add `category` and `isRecurring` to `CreateBillArgs` in `src/store/billStore.ts`**

Find `interface CreateBillArgs` (around line 20). Add the two fields:
```ts
interface CreateBillArgs {
  organizerId: string;
  title: string;
  description?: string;
  currency: Currency;
  splitType: SplitType;
  participants: Participant[];
  lineItems: LineItem[];
  taxRate: number;
  dueDate: Date;
  reminderEnabled: boolean;
  groupPhotoUri?: string;
  category?: 'travel' | 'food' | 'housing' | 'other';   // ADD
  isRecurring?: 'monthly' | 'yearly' | null;             // ADD
}
```

- [ ] **Step 2.3 — Update `createBillInDB` payload type in `src/lib/supabase.ts`**

Find `createBillInDB` (around line 24). Add `category` and `is_recurring` to its payload parameter:
```ts
export async function createBillInDB(payload: {
  organizer_id: string;
  title: string;
  description?: string;
  total_amount: number;
  currency: string;
  due_date: string;
  status: string;
  share_link: string;
  category?: string;       // ADD
  is_recurring?: string;   // ADD
}) {
```

- [ ] **Step 2.4 — Pass `category` and `is_recurring` in `createBill` inside `src/store/billStore.ts`**

Find the `createBillInDB({...})` call (around line 120). Add the two new fields:
```ts
const billRow = await createBillInDB({
  organizer_id: args.organizerId,
  title: args.title,
  description: args.description,
  total_amount: totalAmount,
  currency: args.currency,
  due_date: args.dueDate.toISOString(),
  status: 'active',
  share_link: shareCode,
  category: args.category ?? 'other',      // ADD
  is_recurring: args.isRecurring ?? null,  // ADD
});
```

- [ ] **Step 2.5 — Map `category` and `isRecurring` in `fetchBills` inside `src/store/billStore.ts`**

Find the `bills` mapping in `fetchBills` (around line 66). Add the two new fields:
```ts
const bills: Bill[] = (rows ?? []).map((row) => ({
  id: row.id,
  organizerId: row.organizer_id,
  title: row.title,
  description: row.description ?? undefined,
  totalAmount: Number(row.total_amount),
  currency: row.currency as Currency,
  dueDate: row.due_date,
  status: row.status,
  shareLink: row.share_link,
  category: (row.category ?? 'other') as Bill['category'],     // ADD
  isRecurring: (row.is_recurring ?? null) as Bill['isRecurring'], // ADD
  participants: (row.participants ?? []).map((p: Record<string, unknown>) => ({
    id: p['id'] as string,
    name: p['name'] as string,
    email: p['email'] as string | undefined,
    amount: Number(p['amount']),
    isPaid: Boolean(p['is_paid']),
    paidAt: p['paid_at'] as string | null,
    avatarColor: '#4F46E5',
  })),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
}));
```

- [ ] **Step 2.6 — Map `category` and `isRecurring` in the `newBill` object inside `createBill`**

Find the `newBill` object construction (around line 149). Add the two fields:
```ts
const newBill: Bill = {
  id: billRow.id,
  organizerId: args.organizerId,
  title: args.title,
  description: args.description,
  totalAmount,
  currency: args.currency,
  dueDate: args.dueDate.toISOString(),
  status: 'active',
  shareLink: shareCode,
  category: args.category ?? 'other',      // ADD
  isRecurring: args.isRecurring ?? null,   // ADD
  groupPhotoUrl,
  participants: (participantRows ?? []).map((p, i) => {
    const srcParticipant = args.participants[i];
    return {
      id: p.id,
      name: p.name,
      email: p.email ?? undefined,
      amount: Number(p.amount),
      isPaid: false,
      avatarColor: srcParticipant?.avatarColor ?? '#4F46E5',
    };
  }),
  createdAt: billRow.created_at,
  updatedAt: billRow.updated_at,
};
```

- [ ] **Step 2.7 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors. If errors appear, they will be in the files just modified — fix before continuing.

- [ ] **Step 2.8 — Commit**

```bash
git add src/types/index.ts src/lib/supabase.ts src/store/billStore.ts
git commit -m "feat: add category and isRecurring to Bill type, Supabase layer, and store mapping"
```

---

## Task 3: Pure Compute Functions + Tests

**Files:**
- Create: `src/lib/reportsCompute.ts`
- Create: `__tests__/reportsCompute.test.ts`

- [ ] **Step 3.1 — Create `src/lib/reportsCompute.ts`**

```ts
import { addMonths, differenceInDays, isSameMonth, subMonths, format } from 'date-fns';
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

// ── Section 1: Trend ─────────────────────────────────────────────────────────

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
  const medTotal = sorted[Math.floor(sorted.length / 2)];
  const peak = data[totals.indexOf(maxTotal)];
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
  return (Object.entries(map) as [Category, number][])
    .filter(([, amt]) => amt > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amount]) => ({ cat, amount }));
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
```

- [ ] **Step 3.2 — Create `__tests__/reportsCompute.test.ts`**

```ts
import {
  computeTrend,
  forecastMonths,
  categoryBuckets,
  reliabilityFor,
  reliabilityBand,
  buildInsight,
  topReliability,
} from '../src/lib/reportsCompute';
import type { Bill } from '../src/types';
import { subMonths, addDays, subDays } from 'date-fns';

function makeBill(overrides: Partial<Bill> & { participants?: Bill['participants'] }): Bill {
  return {
    id: 'b1',
    organizerId: 'org1',
    title: 'Test Bill',
    totalAmount: 100,
    currency: 'MYR',
    dueDate: new Date().toISOString(),
    status: 'active',
    shareLink: 'abc123',
    category: 'other',
    isRecurring: null,
    participants: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── computeTrend ──────────────────────────────────────────────────────────────

describe('computeTrend', () => {
  it('returns null when no prior-month data', () => {
    const bills = [
      makeBill({
        createdAt: new Date().toISOString(),
        participants: [{ id: 'p1', name: 'A', amount: 100, isPaid: true, paidAt: null, avatarColor: '' }],
      }),
    ];
    expect(computeTrend(bills)).toBeNull();
  });

  it('returns up direction when current > prior', () => {
    const now = new Date();
    const last = subMonths(now, 1);
    const bills = [
      makeBill({
        createdAt: now.toISOString(),
        participants: [{ id: 'p1', name: 'A', amount: 200, isPaid: true, paidAt: null, avatarColor: '' }],
      }),
      makeBill({
        id: 'b2',
        createdAt: last.toISOString(),
        participants: [{ id: 'p2', name: 'B', amount: 100, isPaid: true, paidAt: null, avatarColor: '' }],
      }),
    ];
    const result = computeTrend(bills);
    expect(result).not.toBeNull();
    expect(result!.direction).toBe('up');
    expect(result!.percent).toBe(100);
  });

  it('returns down direction when current < prior', () => {
    const now = new Date();
    const last = subMonths(now, 1);
    const bills = [
      makeBill({
        createdAt: now.toISOString(),
        participants: [{ id: 'p1', name: 'A', amount: 50, isPaid: true, paidAt: null, avatarColor: '' }],
      }),
      makeBill({
        id: 'b2',
        createdAt: last.toISOString(),
        participants: [{ id: 'p2', name: 'B', amount: 100, isPaid: true, paidAt: null, avatarColor: '' }],
      }),
    ];
    const result = computeTrend(bills);
    expect(result!.direction).toBe('down');
  });
});

// ── forecastMonths ────────────────────────────────────────────────────────────

describe('forecastMonths', () => {
  it('returns 3 months for 3m range', () => {
    expect(forecastMonths([], '3m')).toHaveLength(3);
  });

  it('returns 6 months for 6m range', () => {
    expect(forecastMonths([], '6m')).toHaveLength(6);
  });

  it('returns 12 months for 1y range', () => {
    expect(forecastMonths([], '1y')).toHaveLength(12);
  });

  it('sets recurring = 0 when no monthly bills', () => {
    const data = forecastMonths([], '3m');
    data.forEach((m) => expect(m.recurring).toBe(0));
  });

  it('includes recurring amount from monthly bills', () => {
    const bill = makeBill({
      isRecurring: 'monthly',
      participants: [{ id: 'p1', name: 'A', amount: 500, isPaid: false, paidAt: null, avatarColor: '' }],
    });
    const data = forecastMonths([bill], '3m');
    data.forEach((m) => expect(m.recurring).toBe(500));
  });

  it('each month has a string label', () => {
    const data = forecastMonths([], '3m');
    data.forEach((m) => expect(typeof m.label).toBe('string'));
  });
});

// ── categoryBuckets ───────────────────────────────────────────────────────────

describe('categoryBuckets', () => {
  it('returns empty array for no bills', () => {
    expect(categoryBuckets([])).toEqual([]);
  });

  it('buckets bills with missing category as other', () => {
    const bill = makeBill({
      category: undefined,
      participants: [{ id: 'p1', name: 'A', amount: 100, isPaid: true, paidAt: null, avatarColor: '' }],
    });
    const result = categoryBuckets([bill]);
    expect(result[0].cat).toBe('other');
    expect(result[0].amount).toBe(100);
  });

  it('sorts descending by amount', () => {
    const bills = [
      makeBill({ id: 'b1', category: 'food', participants: [{ id: 'p1', name: 'A', amount: 50, isPaid: true, paidAt: null, avatarColor: '' }] }),
      makeBill({ id: 'b2', category: 'travel', participants: [{ id: 'p2', name: 'B', amount: 200, isPaid: true, paidAt: null, avatarColor: '' }] }),
    ];
    const result = categoryBuckets(bills);
    expect(result[0].cat).toBe('travel');
    expect(result[1].cat).toBe('food');
  });
});

// ── reliabilityFor ────────────────────────────────────────────────────────────

describe('reliabilityFor', () => {
  it('returns null for participant with no payment history', () => {
    const bill = makeBill({
      participants: [{ id: 'p1', name: 'Alice', amount: 100, isPaid: false, paidAt: null, avatarColor: '' }],
    });
    expect(reliabilityFor('Alice', [bill])).toBeNull();
  });

  it('returns score 100 for participant who paid before due date', () => {
    const due = new Date('2026-06-01');
    const paid = subDays(due, 2); // paid 2 days early
    const bill = makeBill({
      dueDate: due.toISOString(),
      participants: [{ id: 'p1', name: 'Alice', amount: 100, isPaid: true, paidAt: paid.toISOString(), avatarColor: '' }],
    });
    const result = reliabilityFor('Alice', [bill]);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
  });

  it('decays score 5pts per day late', () => {
    const due = new Date('2026-06-01');
    const paid = addDays(due, 4); // paid 4 days late → score = 100 - 20 = 80
    const bill = makeBill({
      dueDate: due.toISOString(),
      participants: [{ id: 'p1', name: 'Alice', amount: 100, isPaid: true, paidAt: paid.toISOString(), avatarColor: '' }],
    });
    const result = reliabilityFor('Alice', [bill]);
    expect(result!.score).toBe(80);
  });
});

// ── reliabilityBand ───────────────────────────────────────────────────────────

describe('reliabilityBand', () => {
  it('returns Reliable for score >= 90', () => {
    expect(reliabilityBand(95).label).toBe('Reliable');
    expect(reliabilityBand(90).label).toBe('Reliable');
  });
  it('returns On-time for score 70-89', () => {
    expect(reliabilityBand(70).label).toBe('On-time');
    expect(reliabilityBand(89).label).toBe('On-time');
  });
  it('returns Slow for score 50-69', () => {
    expect(reliabilityBand(50).label).toBe('Slow');
  });
  it('returns At-risk for score < 50', () => {
    expect(reliabilityBand(49).label).toBe('At-risk');
    expect(reliabilityBand(0).label).toBe('At-risk');
  });
});

// ── topReliability ────────────────────────────────────────────────────────────

describe('topReliability', () => {
  it('excludes participants with no paid history', () => {
    const bill = makeBill({
      participants: [{ id: 'p1', name: 'Alice', amount: 100, isPaid: false, paidAt: null, avatarColor: '' }],
    });
    expect(topReliability([bill])).toHaveLength(0);
  });

  it('returns at most 5 participants', () => {
    const due = new Date('2026-06-01').toISOString();
    const paid = subDays(new Date('2026-06-01'), 1).toISOString();
    const participants = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`, name: `Person${i}`, amount: 50, isPaid: true, paidAt: paid, avatarColor: '',
    }));
    const bill = makeBill({ dueDate: due, participants });
    expect(topReliability([bill]).length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 3.3 — Run the tests**

```bash
npx jest __tests__/reportsCompute.test.ts --no-coverage
```
Expected: all tests PASS. If jest is not configured, first run:
```bash
npx expo install jest-expo @types/jest
```
Then add to `package.json` at top level:
```json
"jest": {
  "preset": "jest-expo",
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)"
  ]
}
```
Re-run `npx jest __tests__/reportsCompute.test.ts --no-coverage`. All tests must pass before proceeding.

- [ ] **Step 3.4 — Commit**

```bash
git add src/lib/reportsCompute.ts __tests__/reportsCompute.test.ts
git commit -m "feat: add reportsCompute pure functions with tests"
```

---

## Task 4: `useReportsData` Hook

**Files:**
- Create: `src/hooks/useReportsData.ts`

- [ ] **Step 4.1 — Create `src/hooks/useReportsData.ts`**

```ts
import { useMemo, useState, useCallback } from 'react';
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
```

- [ ] **Step 4.2 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 4.3 — Commit**

```bash
git add src/hooks/useReportsData.ts
git commit -m "feat: add useReportsData hook"
```

---

## Task 5: `StatCardRow` Component

**Files:**
- Create: `src/components/reports/StatCardRow.tsx`

- [ ] **Step 5.1 — Create `src/components/reports/StatCardRow.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { formatCurrency } from '../../lib/reminderTemplates';
import type { Currency } from '../../types';

interface Props {
  totalCollected: number;
  totalOutstanding: number;
  outstandingCount: number;
  trendPercent: number | null;
  trendDirection: 'up' | 'down' | null;
  currency: Currency;
}

export function StatCardRow({
  totalCollected,
  totalOutstanding,
  outstandingCount,
  trendPercent,
  trendDirection,
  currency,
}: Props) {
  return (
    <View style={styles.row}>
      {/* Card A — Collected */}
      <View style={[styles.card, shadow.sm]}>
        <Text style={styles.eyebrowGreen}>COLLECTED (YTD)</Text>
        <Text style={styles.bigNumber}>{formatCurrency(totalCollected, currency)}</Text>
        {trendDirection !== null && trendPercent !== null && (
          <View style={trendDirection === 'up' ? styles.pillUp : styles.pillDown}>
            <Text style={trendDirection === 'up' ? styles.pillTextUp : styles.pillTextDown}>
              {trendDirection === 'up' ? '↗' : '↘'} {trendDirection === 'up' ? '+' : '−'}
              {trendPercent}% vs last month
            </Text>
          </View>
        )}
      </View>

      {/* Card B — Outstanding */}
      <View style={[styles.card, shadow.sm]}>
        <Text style={styles.eyebrowAmber}>OUTSTANDING</Text>
        <Text style={styles.bigNumber}>{formatCurrency(totalOutstanding, currency)}</Text>
        <Text style={styles.sub}>across {outstandingCount} bills</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
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
    fontFamily: typography.mono,
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
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.gray500,
    marginTop: 4,
  },
});
```

- [ ] **Step 5.2 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 5.3 — Commit**

```bash
git add src/components/reports/StatCardRow.tsx
git commit -m "feat: add StatCardRow component"
```

---

## Task 6: `ForecastChart` SVG Component

**Files:**
- Create: `src/components/reports/ForecastChart.tsx`

- [ ] **Step 6.1 — Create `src/components/reports/ForecastChart.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, fontSize } from '../../theme/tokens';
import { formatCurrency } from '../../lib/reminderTemplates';
import type { ForecastMonth } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

interface Props {
  data: ForecastMonth[];
  currency: Currency;
  height?: number;
}

const CHART_HEIGHT = 100;
const Y_AXIS_WIDTH = 36;
const BAR_GAP = 5;
const COLORS = {
  projected: '#4F46E5',
  recurring: '#c7d2fe',
  projectedCurrent: '#10B981',
  recurringCurrent: '#6ee7b7',
};

function BarGroup({
  x,
  barWidth,
  expectedHeight,
  recurringHeight,
  chartHeight,
  isCurrent,
  progress,
}: {
  x: number;
  barWidth: number;
  expectedHeight: number;
  recurringHeight: number;
  chartHeight: number;
  isCurrent: boolean;
  progress: Animated.SharedValue<number>;
}) {
  const totalBarH = expectedHeight + recurringHeight;

  const projectedProps = useAnimatedProps(() => {
    const h = expectedHeight * progress.value;
    return {
      y: chartHeight - totalBarH * progress.value,
      height: h,
    };
  });

  const recurringProps = useAnimatedProps(() => {
    const h = recurringHeight * progress.value;
    return {
      y: chartHeight - totalBarH * progress.value + expectedHeight * progress.value,
      height: h,
    };
  });

  return (
    <G>
      {/* Expected (top) */}
      <AnimatedRect
        x={x}
        width={barWidth}
        rx={3}
        fill={isCurrent ? COLORS.projectedCurrent : COLORS.projected}
        animatedProps={projectedProps}
      />
      {/* Recurring (bottom) */}
      <AnimatedRect
        x={x}
        width={barWidth}
        rx={0}
        fill={isCurrent ? COLORS.recurringCurrent : COLORS.recurring}
        animatedProps={recurringProps}
      />
    </G>
  );
}

export function ForecastChart({ data, currency, height = CHART_HEIGHT }: Props) {
  const progress = useSharedValue(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [svgWidth, setSvgWidth] = useState(280);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) });
    setSelectedIndex(null);
  }, [data]);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((m) => m.recurring + m.expected), 1);
  const chartWidth = svgWidth - Y_AXIS_WIDTH;
  const barWidth = Math.max(4, (chartWidth - BAR_GAP * (data.length - 1)) / data.length);
  const xLabel = height + 16;

  const yLabels = [maxValue, Math.round(maxValue * 0.66), Math.round(maxValue * 0.33), 0];

  return (
    <View>
      <View
        onLayout={(e) => setSvgWidth(e.nativeEvent.layout.width)}
        style={{ width: '100%' }}
      >
        <Svg width={svgWidth} height={height + 24}>
          {/* Y-axis labels */}
          {yLabels.map((val, i) => (
            <SvgText
              key={i}
              x={Y_AXIS_WIDTH - 4}
              y={(height / 3) * i + 4}
              fontSize={8}
              fontFamily={typography.mono}
              fill={colors.gray400}
              textAnchor="end"
            >
              {val >= 1000 ? `${Math.round(val / 1000)}k` : String(val)}
            </SvgText>
          ))}

          {/* Bars */}
          {data.map((month, i) => {
            const totalH = month.recurring + month.expected;
            const barH = (totalH / maxValue) * height;
            const expectedH = (month.expected / maxValue) * height;
            const recurringH = (month.recurring / maxValue) * height;
            const x = Y_AXIS_WIDTH + i * (barWidth + BAR_GAP);

            return (
              <G key={i}>
                <BarGroup
                  x={x}
                  barWidth={barWidth}
                  expectedHeight={expectedH}
                  recurringHeight={recurringH}
                  chartHeight={height}
                  isCurrent={false}
                  progress={progress}
                />
                {/* Tap hit area */}
                <Rect
                  x={x}
                  y={0}
                  width={barWidth}
                  height={height}
                  fill="transparent"
                  onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
                />
                {/* Tooltip */}
                {selectedIndex === i && (
                  <G>
                    <Rect
                      x={Math.min(x - 10, svgWidth - 80)}
                      y={height - barH - 28}
                      width={72}
                      height={20}
                      rx={4}
                      fill="#1e1b4b"
                    />
                    <SvgText
                      x={Math.min(x - 10, svgWidth - 80) + 36}
                      y={height - barH - 14}
                      fontSize={9}
                      fontFamily={typography.mono}
                      fill="#fff"
                      textAnchor="middle"
                    >
                      {formatCurrency(month.recurring + month.expected, currency)}
                    </SvgText>
                  </G>
                )}
                {/* X label */}
                <SvgText
                  x={x + barWidth / 2}
                  y={xLabel}
                  fontSize={9}
                  fontFamily={typography.sans}
                  fill={colors.gray400}
                  textAnchor="middle"
                >
                  {month.label}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.projected }]} />
          <Text style={styles.legendLabel}>Projected</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: COLORS.recurring }]} />
          <Text style={styles.legendLabel}>Recurring</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.gray500,
  },
});
```

- [ ] **Step 6.2 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 6.3 — Commit**

```bash
git add src/components/reports/ForecastChart.tsx
git commit -m "feat: add ForecastChart SVG component with animation and tap tooltip"
```

---

## Task 7: `ForecastCard` Component

**Files:**
- Create: `src/components/reports/ForecastCard.tsx`

- [ ] **Step 7.1 — Create `src/components/reports/ForecastCard.tsx`**

```tsx
import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../theme/tokens';
import { ForecastChart } from './ForecastChart';
import { buildInsight } from '../../lib/reportsCompute';
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

export function ForecastCard({ data, currency, range, onRangeChange }: Props) {
  const insight = buildInsight(data, currency);

  return (
    <View style={[styles.card, shadow.sm]}>
      {/* Header row */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>6-Month forecast</Text>
          <Text style={styles.sub}>Projected outflow + recurring bills</Text>
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

      {/* Chart */}
      <ForecastChart data={data} currency={currency} />

      {/* Insight pill */}
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
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.gray900,
  },
  sub: {
    fontFamily: typography.sans,
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
    fontFamily: typography.sans,
    fontSize: 11,
    color: '#92400e',
    lineHeight: 17,
  },
});
```

- [ ] **Step 7.2 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 7.3 — Commit**

```bash
git add src/components/reports/ForecastCard.tsx
git commit -m "feat: add ForecastCard with range picker and insight pill"
```

---

## Task 8: `CategoryBars` + `CategoryCard`

**Files:**
- Create: `src/components/reports/CategoryBars.tsx`
- Create: `src/components/reports/CategoryCard.tsx`

- [ ] **Step 8.1 — Create `src/components/reports/CategoryBars.tsx`**

```tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '../../theme/tokens';
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
        <Text style={styles.label}>{CATEGORY_LABELS[row.cat]}</Text>
      </View>
      <View style={styles.trackWrap}>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, animStyle, { backgroundColor: CATEGORY_COLORS[row.cat] }]}
          />
        </View>
      </View>
      <Text style={styles.amount}>{formatCurrency(row.amount, currency)}</Text>
    </View>
  );
}

interface Props {
  data: CategoryRow[];
  currency: Currency;
}

export function CategoryBars({ data, currency }: Props) {
  const maxAmount = data.length > 0 ? data[0].amount : 0;
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
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gray700,
  },
  trackWrap: {
    flex: 1,
  },
  track: {
    height: 7,
    backgroundColor: colors.gray100,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  amount: {
    fontFamily: typography.mono,
    fontSize: 11,
    color: colors.gray900,
    width: 64,
    textAlign: 'right',
  },
});
```

- [ ] **Step 8.2 — Create `src/components/reports/CategoryCard.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius, shadow } from '../../theme/tokens';
import { CategoryBars } from './CategoryBars';
import type { CategoryRow } from '../../lib/reportsCompute';
import type { Currency } from '../../types';

interface Props {
  data: CategoryRow[];
  currency: Currency;
}

export function CategoryCard({ data, currency }: Props) {
  return (
    <View style={[styles.card, shadow.sm]}>
      <Text style={styles.title}>Spending by category</Text>
      {data.length === 0 ? (
        <Text style={styles.empty}>No category data yet. Add categories when creating bills.</Text>
      ) : (
        <CategoryBars data={data} currency={currency} />
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
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.gray900,
    marginBottom: spacing[3],
  },
  empty: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gray400,
    lineHeight: 18,
  },
});
```

- [ ] **Step 8.3 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 8.4 — Commit**

```bash
git add src/components/reports/CategoryBars.tsx src/components/reports/CategoryCard.tsx
git commit -m "feat: add CategoryBars and CategoryCard with animated fill"
```

---

## Task 9: `ReliabilityCard`

**Files:**
- Create: `src/components/reports/ReliabilityCard.tsx`

- [ ] **Step 9.1 — Create `src/components/reports/ReliabilityCard.tsx`**

```tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, typography, spacing, radius, shadow } from '../../theme/tokens';
import type { ReliabilityResult } from '../../lib/reportsCompute';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function ReliabilityRow({ item }: { item: ReliabilityResult }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(item.score / 100, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [item.score]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const avgLabel =
    item.avgDays <= 0
      ? `avg ${Math.abs(item.avgDays)}d early`
      : `avg ${item.avgDays}d to pay`;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.avatar,
          { backgroundColor: hexToRgba(item.band.color, 0.12) },
        ]}
      >
        <Text style={[styles.avatarText, { color: item.band.color }]}>
          {getInitials(item.name)}
        </Text>
      </View>
      <View style={styles.nameGroup}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.sub}>{avgLabel}</Text>
      </View>
      <View style={styles.scoreGroup}>
        <View style={styles.barTrack}>
          <Animated.View
            style={[styles.barFill, barStyle, { backgroundColor: item.band.color }]}
          />
        </View>
        <Text style={[styles.score, { color: item.band.color }]}>{item.score}</Text>
      </View>
    </View>
  );
}

interface Props {
  data: ReliabilityResult[];
}

export function ReliabilityCard({ data }: Props) {
  return (
    <View style={[styles.card, shadow.sm]}>
      <Text style={styles.title}>Who pays on time</Text>
      <Text style={styles.cardSub}>Based on past 6 months</Text>
      {data.length === 0 ? (
        <Text style={styles.empty}>
          Not enough data yet — needs 1+ paid bills with a due date set.
        </Text>
      ) : (
        <View style={styles.list}>
          {data.map((item) => (
            <ReliabilityRow key={item.name} item={item} />
          ))}
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
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.gray900,
  },
  cardSub: {
    fontFamily: typography.sans,
    fontSize: 11,
    color: colors.gray400,
    marginBottom: spacing[3],
    marginTop: 2,
  },
  list: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: typography.sansBold,
    fontSize: 11,
  },
  nameGroup: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: typography.sansBold,
    fontSize: 12,
    color: colors.gray900,
  },
  sub: {
    fontFamily: typography.sans,
    fontSize: 10,
    color: colors.gray400,
  },
  scoreGroup: {
    width: 110,
    alignItems: 'flex-end',
    gap: 3,
  },
  barTrack: {
    width: '100%',
    height: 5,
    backgroundColor: colors.gray100,
    borderRadius: 3,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  score: {
    fontFamily: typography.sansBold,
    fontSize: 11,
  },
  empty: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gray400,
    lineHeight: 18,
  },
});
```

- [ ] **Step 9.2 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 9.3 — Commit**

```bash
git add src/components/reports/ReliabilityCard.tsx
git commit -m "feat: add ReliabilityCard with animated progress bars and band colors"
```

---

## Task 10: Export Lib + `ExportCard`

**Files:**
- Create: `src/lib/exportCsv.ts`
- Create: `src/lib/exportPdf.ts`
- Create: `src/components/reports/ExportCard.tsx`

- [ ] **Step 10.1 — Create `src/lib/exportCsv.ts`**

```ts
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import type { Bill, Currency } from '../types';

export async function exportCSV(bills: Bill[], currency: Currency): Promise<void> {
  const headers = [
    'Bill', 'Participant', 'Amount', 'Currency', 'Status',
    'Paid At', 'Due Date', 'Category', 'Recurring',
  ];

  const rows = bills.flatMap((b) =>
    b.participants.map((p) => [
      b.title,
      p.name,
      p.amount.toFixed(2),
      currency,
      p.isPaid ? 'Paid' : 'Unpaid',
      p.paidAt ?? '',
      b.dueDate,
      b.category ?? 'other',
      b.isRecurring ?? '',
    ])
  );

  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const filename = `gocheck-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  const path = (FileSystem.documentDirectory ?? '') + filename;

  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'Export GoCheck Data',
  });
}
```

- [ ] **Step 10.2 — Create `src/lib/exportPdf.ts`**

```ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import type { Bill, Currency } from '../types';
import { formatCurrency } from './reminderTemplates';
import { CATEGORY_LABELS } from './reportsCompute';
import type { Category } from './reportsCompute';

function buildReportHtml(bills: Bill[], currency: Currency): string {
  const totalCollected = bills
    .flatMap((b) => b.participants)
    .filter((p) => p.isPaid)
    .reduce((s, p) => s + p.amount, 0);

  const totalOutstanding = bills
    .flatMap((b) => b.participants)
    .filter((p) => !p.isPaid)
    .reduce((s, p) => s + p.amount, 0);

  const today = format(new Date(), 'dd MMM yyyy');

  const billRows = bills
    .map(
      (b) => `
    <tr>
      <td>${b.title}</td>
      <td>${format(new Date(b.dueDate), 'dd MMM yyyy')}</td>
      <td>${CATEGORY_LABELS[(b.category ?? 'other') as Category]}</td>
      <td>${b.isRecurring ?? '—'}</td>
      <td style="text-align:right">${formatCurrency(
        b.participants.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0),
        currency
      )}</td>
      <td style="text-align:right">${formatCurrency(
        b.participants.filter((p) => !p.isPaid).reduce((s, p) => s + p.amount, 0),
        currency
      )}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=DM+Mono&display=swap" rel="stylesheet"/>
<style>
  body { font-family: 'DM Sans', sans-serif; padding: 32px; color: #111827; }
  h1 { font-size: 24px; color: #4F46E5; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 32px; }
  .stats { display: flex; gap: 24px; margin-bottom: 32px; }
  .stat { background: #f8f9ff; border-radius: 12px; padding: 16px 20px; min-width: 160px; }
  .stat-label { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #6b7280; }
  .stat-value { font-family: 'DM Mono', monospace; font-size: 22px; font-weight: 700; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; background: #f3f4f6; color: #374151; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; }
  tr:last-child td { border-bottom: none; }
  .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
  <h1>GoCheck — Reports & Insights</h1>
  <div class="meta">Generated on ${today}</div>
  <div class="stats">
    <div class="stat">
      <div class="stat-label">Collected</div>
      <div class="stat-value">${formatCurrency(totalCollected, currency)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Outstanding</div>
      <div class="stat-value">${formatCurrency(totalOutstanding, currency)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Bill</th><th>Due Date</th><th>Category</th><th>Recurring</th>
        <th style="text-align:right">Collected</th><th style="text-align:right">Outstanding</th>
      </tr>
    </thead>
    <tbody>${billRows}</tbody>
  </table>
  <div class="footer">GoCheck · ${today}</div>
</body>
</html>`;
}

export async function exportPDF(bills: Bill[], currency: Currency): Promise<void> {
  const html = buildReportHtml(bills, currency);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Export GoCheck Report',
  });
}
```

- [ ] **Step 10.3 — Create `src/components/reports/ExportCard.tsx`**

```tsx
import React, { useState } from 'react';
import {
  View, Text, Pressable, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, typography, spacing, radius, shadow } from '../../theme/tokens';
import { exportCSV } from '../../lib/exportCsv';
import { exportPDF } from '../../lib/exportPdf';
import type { Bill, Currency } from '../../types';

interface Props {
  bills: Bill[];
  currency: Currency;
}

export function ExportCard({ bills, currency }: Props) {
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleCsv = async () => {
    if (bills.length === 0) {
      Alert.alert('No data', 'Create some bills first before exporting.');
      return;
    }
    setIsExportingCsv(true);
    try {
      await exportCSV(bills, currency);
    } catch (e) {
      Alert.alert('Export failed', 'Could not export CSV. Please try again.');
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handlePdf = async () => {
    if (bills.length === 0) {
      Alert.alert('No data', 'Create some bills first before exporting.');
      return;
    }
    setIsExportingPdf(true);
    try {
      await exportPDF(bills, currency);
    } catch (e) {
      Alert.alert('Export failed', 'Could not generate PDF. Please try again.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <View style={[styles.card, shadow.sm]}>
      <Text style={styles.title}>Export</Text>
      <Text style={styles.sub}>Download a full breakdown for accounting or tax filing.</Text>
      <View style={styles.btnRow}>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={handleCsv}
          disabled={isExportingCsv}
        >
          {isExportingCsv ? (
            <ActivityIndicator size="small" color={colors.gray600} />
          ) : (
            <Feather name="download" size={14} color={colors.gray600} />
          )}
          <Text style={styles.btnLabel}>{isExportingCsv ? 'Preparing…' : 'CSV'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
          onPress={handlePdf}
          disabled={isExportingPdf}
        >
          {isExportingPdf ? (
            <ActivityIndicator size="small" color={colors.gray600} />
          ) : (
            <Feather name="file-text" size={14} color={colors.gray600} />
          )}
          <Text style={styles.btnLabel}>{isExportingPdf ? 'Preparing…' : 'PDF'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius['2xl'],
    padding: spacing[4],
  },
  title: {
    fontFamily: typography.sansBold,
    fontSize: 14,
    color: colors.gray900,
  },
  sub: {
    fontFamily: typography.sans,
    fontSize: 12,
    color: colors.gray500,
    marginTop: 2,
    marginBottom: spacing[3],
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  btnPressed: {
    backgroundColor: colors.gray50,
  },
  btnLabel: {
    fontFamily: typography.sansBold,
    fontSize: 13,
    color: colors.gray700,
  },
});
```

- [ ] **Step 10.4 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 10.5 — Commit**

```bash
git add src/lib/exportCsv.ts src/lib/exportPdf.ts src/components/reports/ExportCard.tsx
git commit -m "feat: add CSV/PDF export lib and ExportCard component"
```

---

## Task 11: `reports.tsx` Screen Shell

**Files:**
- Create: `app/(tabs)/reports.tsx`

- [ ] **Step 11.1 — Create `app/(tabs)/reports.tsx`**

```tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  ActivityIndicator, Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors, typography, fontSize, spacing, radius, shadow } from '../../src/theme/tokens';
import { useReportsData, ForecastRange } from '../../src/hooks/useReportsData';
import { useBillStore } from '../../src/store/billStore';
import { StatCardRow } from '../../src/components/reports/StatCardRow';
import { ForecastCard } from '../../src/components/reports/ForecastCard';
import { CategoryCard } from '../../src/components/reports/CategoryCard';
import { ReliabilityCard } from '../../src/components/reports/ReliabilityCard';
import { ExportCard } from '../../src/components/reports/ExportCard';

// ── Skeleton placeholder ──────────────────────────────────────────────────────
function SkeletonBlock({ height = 100 }: { height?: number }) {
  return (
    <View
      style={[
        styles.skeleton,
        { height },
      ]}
    />
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
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

// ── Main screen ───────────────────────────────────────────────────────────────
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

  // Fetch bills on mount if the store is empty (e.g. user opens Reports tab first)
  useEffect(() => {
    if (bills.length === 0) {
      refresh();
    }
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
      {/* Header */}
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
    fontFamily: typography.sans,
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
    color: '#fff',
  },
});
```

- [ ] **Step 11.2 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 11.3 — Commit**

```bash
git add app/(tabs)/reports.tsx
git commit -m "feat: add reports.tsx screen shell with skeleton, empty state, pull-to-refresh"
```

---

## Task 12: Rename Activity Tab → Reports in `_layout.tsx`

**Files:**
- Modify: `app/(tabs)/_layout.tsx`
- Delete (rename): `app/(tabs)/activity.tsx` → handled by creating `reports.tsx` above; just update the layout

- [ ] **Step 12.1 — Update `_layout.tsx` to rename the tab**

Find the `activity` screen entry (around line 68) and replace it:

Old:
```tsx
<Tabs.Screen
  name="activity"
  options={{
    title: 'Activity',
    tabBarIcon: ({ focused }) => <TabBarIcon name="activity" focused={focused} />,
  }}
/>
```

New:
```tsx
<Tabs.Screen
  name="reports"
  options={{
    title: 'Reports',
    tabBarIcon: ({ focused }) => <TabBarIcon name="bar-chart-2" focused={focused} />,
  }}
/>
```

- [ ] **Step 12.2 — Delete the old activity.tsx**

```bash
rm app/(tabs)/activity.tsx
```

Expo Router routes files by name. Deleting `activity.tsx` and having `reports.tsx` means the "reports" route is served. The layout now points to `name="reports"`.

- [ ] **Step 12.3 — Type-check and verify no broken imports**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 12.4 — Commit**

```bash
git add app/(tabs)/_layout.tsx
git rm app/(tabs)/activity.tsx
git commit -m "feat: rename Activity tab to Reports with bar-chart-2 icon"
```

---

## Task 13: Category Picker in Bill Creation

**Files:**
- Modify: `app/(modals)/create.tsx`

- [ ] **Step 13.1 — Add category state in `create.tsx`**

Find the state declarations block (around line 160). Add one new state variable after the existing ones:
```tsx
const [category, setCategory] = useState<'travel' | 'food' | 'housing' | 'other'>('other');
```

- [ ] **Step 13.2 — Add the category picker UI**

Find the Bill Details section in the JSX — specifically after the description `TextInput` block (around line 487). Insert the category picker:
```tsx
{/* Category picker */}
<View style={styles.fieldGroup}>
  <Text style={styles.fieldLabel}>Category</Text>
  <View style={styles.chipRow}>
    {(
      [
        { key: 'travel', label: '✈ Travel', color: '#4F46E5' },
        { key: 'food', label: '🍜 Food', color: '#f59e0b' },
        { key: 'housing', label: '🏠 Housing', color: '#10B981' },
        { key: 'other', label: '○ Other', color: '#94a3b8' },
      ] as const
    ).map((item) => (
      <Pressable
        key={item.key}
        style={[
          styles.chip,
          category === item.key && { backgroundColor: item.color, borderColor: item.color },
        ]}
        onPress={() => setCategory(item.key)}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Text
          style={[
            styles.chipLabel,
            category === item.key && { color: '#fff' },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    ))}
  </View>
</View>
```

- [ ] **Step 13.3 — Add the chip styles to the create.tsx StyleSheet**

Find the StyleSheet at the bottom of `create.tsx` and add:
```tsx
fieldGroup: {
  marginBottom: 16,
},
fieldLabel: {
  fontFamily: typography.sansMedium,
  fontSize: 13,
  color: colors.gray700,
  marginBottom: 8,
},
chipRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
chip: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: radius.full,
  borderWidth: 1.5,
  borderColor: colors.border,
  backgroundColor: colors.surface,
},
chipLabel: {
  fontFamily: typography.sansMedium,
  fontSize: 12,
  color: colors.gray600,
},
```

- [ ] **Step 13.4 — Pass `category` to the `createBill` call**

Find the `createBill({...})` call (around line 314). Add `category`:
```tsx
await createBill({
  organizerId: await getOrganizerId(),
  title: title.trim(),
  description: description.trim() || undefined,
  currency,
  splitType,
  participants: splitType === 'equal' ? distributeEqual(effectiveTotal, participants) : participants,
  lineItems,
  taxRate,
  dueDate,
  reminderEnabled,
  groupPhotoUri,
  category,          // ADD
  isRecurring: null, // ADD — recurring toggle is out of scope for v1
});
```

- [ ] **Step 13.5 — Type-check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 13.6 — Commit**

```bash
git add app/(modals)/create.tsx
git commit -m "feat: add category chip picker to bill creation flow"
```

---

## Task 14: Final Verification

- [ ] **Step 14.1 — Run all tests**

```bash
npx jest --no-coverage
```
Expected: all tests pass.

- [ ] **Step 14.2 — Full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 14.3 — Start the app and verify the Reports tab**

```bash
npx expo start
```

Open the app. Tap the **Reports** tab (bar-chart icon). Verify:
- Skeleton shows while loading, then disappears
- Stat cards show correct totals
- Forecast chart renders bars, animates on mount, tap shows tooltip
- Segmented control switches 3M/6M/1Y without remount
- Category card shows bars (will show "other" for existing bills until they get categories)
- Reliability card shows participants with paid history
- Export CSV button triggers native share sheet with a `.csv` file
- Export PDF button shows "Preparing…" then triggers share sheet
- Pull-to-refresh works
- Create a new bill — verify the category chip picker appears

- [ ] **Step 14.4 — Final commit**

```bash
git add .
git commit -m "feat: complete Reports & Insights tab implementation"
```

---

## Acceptance Criteria Checklist

- [ ] Activity tab renamed to Reports with `bar-chart-2` icon
- [ ] Collected YTD and Outstanding reflect live data
- [ ] Trend pill shows ↗/↘ or is hidden based on month-over-month
- [ ] Forecast range picker switches 3M/6M/1Y without full remount
- [ ] Forecast bars animate on mount; tap shows amount tooltip
- [ ] Insight pill auto-generates from peak/recurring detection
- [ ] Category bars sorted descending; missing categories bucketed as `other`
- [ ] Category bars animate fill width on mount
- [ ] Reliability list shows top 5; first-timers excluded; colors match band
- [ ] CSV downloads a valid file via native share sheet
- [ ] PDF shows busy state then triggers native share sheet
- [ ] Pull-to-refresh works
- [ ] Skeleton loaders shown while loading with no bills
- [ ] Empty state shown when `bills.length === 0`
- [ ] Category picker appears in bill creation flow
- [ ] `npx tsc --noEmit` passes
- [ ] All tests pass
