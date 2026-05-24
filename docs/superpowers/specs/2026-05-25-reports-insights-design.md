# Reports & Insights Tab — Design Spec

**Date:** 2026-05-25
**Status:** Approved
**Approach:** Option A — Custom SVG charts + dedicated data hook + full CSV/PDF export

---

## Overview

Replace the placeholder `activity.tsx` tab with a fully-functional `reports.tsx` screen.
The screen surfaces five sections of insight derived entirely from existing `bills` + `participants` data, with two optional new columns (`category`, `is_recurring`) added to `bills` via migration.

No new Supabase tables. All computation happens client-side via `useReportsData`, cached with `useMemo`.

---

## Tab Change

| Before | After |
|--------|-------|
| `app/(tabs)/activity.tsx` | renamed → `app/(tabs)/reports.tsx` |
| Tab label: "Activity" | Tab label: "Reports" |
| Tab icon: `activity` (Feather) | Tab icon: `bar-chart-2` (Feather) |

Update `app/(tabs)/_layout.tsx`: change `name="activity"` → `name="reports"`, update title and icon.

---

## Schema Migration

```sql
-- supabase/migrations/003_reports_columns.sql
alter table bills
  add column if not exists category text
    default 'other'
    check (category in ('travel', 'food', 'housing', 'other')),
  add column if not exists is_recurring text
    check (is_recurring in ('monthly', 'yearly') or is_recurring is null);
```

Update the `Bill` TypeScript interface in `src/types/index.ts`:

```ts
category?: 'travel' | 'food' | 'housing' | 'other';
is_recurring?: 'monthly' | 'yearly' | null;
```

---

## Category Picker in Bill Creation

When a user creates a bill, show four chip buttons below the title/description fields:

```
[ ✈ Travel ]  [ 🍜 Food ]  [ 🏠 Housing ]  [ ○ Other ]
```

- Single-select; default is `other`
- Chips use the category color map (see Section 3)
- Selected chip: filled background, white label
- Unselected: surface background, slate-600 label, border

---

## File Structure

```
app/(tabs)/reports.tsx                  ← screen shell
src/components/reports/
  StatCardRow.tsx                       ← Section 1: two stat cards
  ForecastCard.tsx                      ← Section 2: chart card + picker + pill
  ForecastChart.tsx                     ← stacked bar chart (react-native-svg)
  CategoryCard.tsx                      ← Section 3: spending by category
  CategoryBars.tsx                      ← horizontal bar rows
  ReliabilityCard.tsx                   ← Section 4: who pays on time
  ExportCard.tsx                        ← Section 5: CSV + PDF buttons
src/hooks/useReportsData.ts             ← all data computation, memoised
src/lib/reportsCompute.ts               ← pure functions: forecast, category, reliability
src/lib/exportCsv.ts                    ← CSV generator
src/lib/exportPdf.ts                    ← PDF generator (expo-print)
supabase/migrations/003_reports_columns.sql
```

---

## Data Hook — `useReportsData`

Single hook consumed by `reports.tsx`. Pulls from the existing Zustand `billStore` (already loaded) and derives everything via `useMemo`. No extra Supabase round-trips at render time.

```ts
const {
  totalCollected,       // sum of participants.amount where is_paid = true
  totalOutstanding,     // sum of participants.amount where is_paid = false
  outstandingCount,     // count of bills with at least one unpaid participant
  trendPercent,         // month-over-month % change (null if no prior data)
  trendDirection,       // 'up' | 'down' | null
  forecastData,         // ForecastMonth[] for selected range
  categoryData,         // CategoryRow[] sorted desc by amount
  reliabilityData,      // ReliabilityRow[] top 5 sorted desc by score
  currency,             // organizer's currency from bills[0].currency ?? 'MYR'
  isLoading,
  refresh,              // calls billStore.fetchBills(organizerId)
} = useReportsData();
```

Bill status mapping: `'complete'` (not `'settled'`) = settled bill. Outstanding = bills where status is `'active'` and at least one participant has `is_paid = false`.

---

## Section 1 — Stat Row

Two cards, `flex: 1` each, `gap: 12`, inside a row container.

**Card A — Collected YTD**
- Eyebrow: `COLLECTED (YTD)` — emerald-700, 9px, uppercase, letter-spacing 0.08em
- Big number: `formatCurrency(totalCollected, currency)` — DM Mono, 20px bold
- Trend pill:
  - `↗ +X% vs last month` on green-100 background, green-700 text
  - `↘ −X% vs last month` on red-100 background, red-600 text
  - Hidden if `trendDirection === null` (no prior month data)

**Card B — Outstanding**
- Eyebrow: `OUTSTANDING` — amber-600
- Big number: `formatCurrency(totalOutstanding, currency)` — DM Mono, 20px bold
- Sub: `across {outstandingCount} bills` — 10px, gray-500

**Trend computation** (in `reportsCompute.ts`):

```ts
function computeTrend(bills: Bill[]): { percent: number; direction: 'up' | 'down' } | null {
  const now = new Date();
  const thisMonth = (b: Bill) => isSameMonth(new Date(b.created_at), now);
  const lastMonth = (b: Bill) => isSameMonth(new Date(b.created_at), subMonths(now, 1));

  const sumPaid = (filtered: Bill[]) =>
    filtered.flatMap(b => b.participants)
      .filter(p => p.is_paid)
      .reduce((s, p) => s + p.amount, 0);

  const current = sumPaid(bills.filter(thisMonth));
  const prior   = sumPaid(bills.filter(lastMonth));
  if (prior === 0) return null;

  const pct = Math.round(((current - prior) / prior) * 100);
  return { percent: Math.abs(pct), direction: pct >= 0 ? 'up' : 'down' };
}
```

---

## Section 2 — 6-Month Forecast

### Header
- Title: `6-Month forecast` — 14px bold
- Sub: `Projected outflow + recurring bills` — 11px gray-400
- Segmented control: `3M · 6M · 1Y` — indigo-filled pill for active, gray-100 background track

### Chart — `<ForecastChart />`

Built with `react-native-svg`. No external chart library.

**Props:** `data: ForecastMonth[]`, `maxValue: number`, `height?: number` (default 120)

**Layout:**
- Y-axis: 4 labels (0, 33%, 66%, 100% of maxValue), 28px wide, DM Mono 8px gray-400
- Bars: flex-fill per month, each bar split into two `<Rect>` stacked vertically
  - Bottom: `recurring` — indigo-200 (`#c7d2fe`)
  - Top: `expected` — indigo-600 (`#4F46E5`)
  - Current month (index 0 if range includes present): emerald fills instead of indigo
  - Bar width: computed from SVG width / monthCount with 4px gap
  - Corner radius 3px on top of the top segment only
- X-axis labels: month abbreviation, 9px gray-400, centered under each bar
- Entrance animation: bars grow from height 0 → full over 400ms using `react-native-reanimated` (already in project via `react-native-gesture-handler`)
- **Tap to reveal tooltip:** tapping a bar shows a floating label above it with the total amount — `formatCurrency(recurring + expected, currency)`. Tap elsewhere to dismiss.

**Legend:** two dots + labels — `Projected` (indigo-600), `Recurring` (indigo-200)

### Forecast Computation

```ts
function forecastMonths(bills: Bill[], range: '3m' | '6m' | '1y'): ForecastMonth[] {
  const monthCount = range === '3m' ? 3 : range === '6m' ? 6 : 12;
  const months = nextNMonths(monthCount); // [{label:'Jun',year:2026,monthIndex:5}, ...]

  const recurringPerMonth = bills
    .filter(b => b.is_recurring === 'monthly')
    .flatMap(b => b.participants)
    .reduce((s, p) => s + p.amount, 0);

  const allAmounts = bills.flatMap(b => b.participants).map(p => p.amount);
  const avgAmount  = allAmounts.length
    ? allAmounts.reduce((s, a) => s + a, 0) / allAmounts.length
    : 0;

  return months.map((m, i) => ({
    label:     m.label,
    year:      m.year,
    recurring: recurringPerMonth,
    expected:  Math.round(avgAmount * 2.4 * (1 + 0.15 * Math.sin(i * 1.1))),
  }));
}
```

`nextNMonths` is implemented in `reportsCompute.ts`:

```ts
function nextNMonths(n: number): { label: string; year: number; monthIndex: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const d = addMonths(new Date(), i + 1);
    return { label: format(d, 'MMM'), year: d.getFullYear(), monthIndex: d.getMonth() };
  });
}
```

Index 0 is always one month ahead of today (future-only forecast).

### Insight Pill

Amber-50 background, amber-800 border, amber-900 text. Lightning bolt icon (⚡) in amber circle.

Logic:
```ts
function buildInsight(data: ForecastMonth[], currency: Currency): string | null {
  if (data.length === 0) return null;
  const totals    = data.map(m => m.recurring + m.expected);
  const maxTotal  = Math.max(...totals);
  const medTotal  = totals.slice().sort((a,b)=>a-b)[Math.floor(totals.length/2)];
  const peak      = data[totals.indexOf(maxTotal)];
  const recurringTotal = data.reduce((s, m) => s + m.recurring, 0);
  const totalAll  = totals.reduce((s, t) => s + t, 0);

  if (recurringTotal === 0) {
    return `Based on your average monthly volume, ${peak.label} looks like the busiest month at ${formatCurrency(maxTotal, currency)}.`;
  }
  if (recurringTotal / totalAll > 0.6) {
    return `Most of your projected spend is recurring (${formatCurrency(recurringTotal, currency)}). Consider auditing subscriptions.`;
  }
  if (maxTotal > medTotal * 1.5) {
    return `Heads up: ${peak.label} will peak at ${formatCurrency(maxTotal, currency)}. Recurring bills add ${formatCurrency(recurringTotal, currency)} over the period — consider negotiating annual rate locks now.`;
  }
  return `${peak.label} is your highest projected month at ${formatCurrency(maxTotal, currency)}.`;
}
```

Hidden entirely if `data.length === 0`.

---

## Section 3 — Spending by Category

### Category Color Map

```ts
const CATEGORY_COLORS = {
  travel:  '#4F46E5', // indigo-600
  food:    '#f59e0b', // amber-500
  housing: '#10B981', // emerald-500
  other:   '#94a3b8', // slate-400
} as const;

const CATEGORY_LABELS = {
  travel:  'Travel',
  food:    'Food & Dining',
  housing: 'Housing',
  other:   'Other',
};
```

### Computation

```ts
function categoryBuckets(bills: Bill[]): CategoryRow[] {
  const map: Record<string, number> = { travel:0, food:0, housing:0, other:0 };
  for (const bill of bills) {
    const cat = bill.category ?? 'other';
    const total = bill.participants.reduce((s, p) => s + p.amount, 0);
    map[cat] = (map[cat] ?? 0) + total;
  }
  return Object.entries(map)
    .filter(([, amt]) => amt > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amount]) => ({ cat: cat as Category, amount }));
}
```

### `<CategoryBars />` Row Layout

Each row: `[colored dot + label (84px)] [bar track flex:1] [amount (56px right-aligned)]`

- Bar fill animates width 0 → percentage on mount (300ms ease-out)
- Track height: 7px, border-radius 4px, gray-100 background
- Max bar = 100% width (the largest category). Others are `amount / maxAmount * 100%`
- Amount: DM Mono 11px

---

## Section 4 — Who Pays on Time

### Computation — `reliabilityFor`

Reuses `paidAt` from `participants` table (already exists). Computes over all bills for a given participant name (matched by `name` string, since there's no participant user account).

```ts
function reliabilityFor(name: string, bills: Bill[]) {
  const history = bills.flatMap(b =>
    b.participants
      .filter(p => p.name === name && p.is_paid && p.paid_at && b.due_date)
      .map(p => ({
        daysLate: differenceInDays(new Date(p.paid_at!), new Date(b.due_date)),
      }))
  );
  if (history.length === 0) return null;

  const avgDays = history.reduce((s, h) => s + h.daysLate, 0) / history.length;
  const score   = Math.max(0, Math.min(100, 100 - Math.max(0, Math.round(avgDays)) * 5));
  return { score, avgDays: Math.round(avgDays) };
}

function reliabilityBand(score: number) {
  if (score >= 90) return { label: 'Reliable', color: '#10B981' }; // emerald
  if (score >= 70) return { label: 'On-time',  color: '#4F46E5' }; // indigo
  if (score >= 50) return { label: 'Slow',     color: '#f59e0b' }; // amber
  return               { label: 'At-risk',  color: '#ef4444' }; // red
}
```

### List Layout

- Collect all unique participant names across all bills
- Compute `reliabilityFor` for each; exclude nulls (first-timers / no history)
- Sort descending by score; take top 5
- Each row: `[32px avatar] [name + avg sub] [progress bar + score]`
- Avatar: initials (first letter of first + last word of name), background = band color at 10% opacity, text = band color
- Progress bar: 100px wide, 5px tall, filled to `score%`, color = band color
- Score: 11px bold, band color, right-aligned
- Bar animates width on mount using `react-native-reanimated` (already installed at v3.10.1)

**Empty state:** "Not enough data yet — needs 1+ paid bills with a due date set."

---

## Section 5 — Export

### CSV — `exportCsv.ts`

```ts
async function exportCSV(bills: Bill[], currency: Currency) {
  const headers = ['Bill','Participant','Amount','Currency','Status','Paid At','Due Date','Category','Recurring'];
  const rows = bills.flatMap(b =>
    b.participants.map(p => [
      b.title,
      p.name,
      p.amount,
      currency,
      p.is_paid ? 'Paid' : 'Unpaid',
      p.paid_at ?? '',
      b.due_date,
      b.category ?? 'other',
      b.is_recurring ?? '',
    ])
  );
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const filename = `gocheck-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  const path = FileSystem.documentDirectory + filename;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export GoCheck Data' });
}
```

Dependencies: `expo-file-system`, `expo-sharing` (install both).

### PDF — `exportPdf.ts`

```ts
async function exportPDF(bills: Bill[], currency: Currency) {
  const html = buildReportHtml(bills, currency); // styled HTML string
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export GoCheck Report' });
}
```

`buildReportHtml` returns a self-contained HTML string with inline styles — includes all 5 sections as a print-friendly layout. Uses the GoCheck color palette and DM Sans via Google Fonts CDN.

Dependency: `expo-print` (install).

**UX:** PDF button shows `"Preparing…"` spinner state for ~1–2s during generation. Uses `ActivityIndicator` replacing the icon while `isExportingPdf` is true.

---

## Additional Polish Features

These go beyond the original spec and improve feel:

| Feature | Where | Detail |
|---------|-------|--------|
| Pull-to-refresh | `reports.tsx` | `<ScrollView refreshControl={<RefreshControl />}>` calls `refresh()` |
| Skeleton loaders | All cards | Gray animated placeholder blocks while `isLoading = true` |
| Bar entrance animation | `ForecastChart`, `CategoryBars`, `ReliabilityCard` | Width/height animates 0→full on mount, 350ms, `Easing.out(Easing.cubic)` |
| Forecast bar tap tooltip | `ForecastChart` | Floating label showing total amount, dismisses on next tap |
| Empty screen state | `reports.tsx` | Full-screen empty state with illustration + "Create your first bill" button if `bills.length === 0` |
| Category picker in bill creation | Existing create-bill modal | 4 chips below description, single-select, default `other` |

---

## New Packages to Install

```
expo install expo-file-system expo-sharing expo-print
```

No new chart library. `react-native-svg` (already installed at v15.2.0) covers all chart rendering.

---

## Alignment Fixes vs Original Spec

| Spec says | Actual codebase | Resolution |
|-----------|----------------|------------|
| `status != 'settled'` | status is `'active' \| 'complete' \| 'cancelled'` | Outstanding = bills where `status === 'active'` |
| `isPaid`, `paidAt` (camelCase) | DB columns are `is_paid`, `paid_at` | Use snake_case from Supabase; types in `src/types` already map these |
| `formatCurrency` in `reminderTemplates.ts` | Same file | Import from there directly; no move needed |
| `computeReliability` in `queueUtils.ts` returns a label only | Need score + avgDays | Write new `reliabilityFor` in `reportsCompute.ts`; the old function stays |
| `bills.dueDate` | DB column is `due_date` | Use `bill.due_date` throughout |

---

## Acceptance Criteria

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
- [ ] Skeleton loaders shown while `isLoading = true`
- [ ] Empty state shown when `bills.length === 0`
- [ ] Category picker appears in bill creation flow
- [ ] `npx tsc --noEmit` passes

---

## Out of Scope (v1)

- Saved/scheduled exports
- Multi-currency aggregation
- Year-over-year comparison
- Drill-down per category (tap bar → filtered bill list)
- Custom date ranges (only 3M/6M/1Y presets)
- Reliability trend over time
