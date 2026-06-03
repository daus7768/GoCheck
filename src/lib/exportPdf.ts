import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { format, differenceInDays } from 'date-fns';
import type { Bill, Currency } from '../types';
import { formatCurrency } from './reminderTemplates';
import {
  organizerSummary,
  monthlyActuals,
  categoryBuckets,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  topReliability,
} from './reportsCompute';
import type { Category } from './reportsCompute';

interface ExportOptions {
  organizerName?: string;
}

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadge(status: string): string {
  const map: Record<string, string> = {
    active: '#4F46E5',
    complete: '#10B981',
    cancelled: '#94a3b8',
    OVERDUE: '#ef4444',
    UPCOMING: '#f59e0b',
  };
  const color = map[status] ?? '#6b7280';
  return `<span class="badge" style="background:${color}1a;color:${color};border-color:${color}33">${esc(status)}</span>`;
}

function buildReportHtml(
  bills: Bill[],
  currency: Currency,
  opts: ExportOptions
): string {
  const summary = organizerSummary(bills);
  const history = monthlyActuals(bills, 12);
  const cats = categoryBuckets(bills);
  const reliable = topReliability(bills);
  const today = format(new Date(), 'dd MMM yyyy');
  const todayLong = format(new Date(), 'EEEE, dd MMMM yyyy · HH:mm');
  const organizer = opts.organizerName ?? 'Organizer';
  const now = new Date();
  const periodLabel = `${format(new Date(now.getFullYear(), 0, 1), 'dd MMM yyyy')} – ${format(now, 'dd MMM yyyy')}`;

  // ── KPI cards ─────────────────────────────────────────────────────────────
  const kpis = `
    <div class="kpi-grid">
      <div class="kpi kpi-collected">
        <div class="kpi-label">Collected</div>
        <div class="kpi-value">${esc(formatCurrency(summary.totalCollected, currency))}</div>
        <div class="kpi-hint">${summary.collectionRate}% of ${esc(formatCurrency(summary.totalBilled, currency))} billed</div>
      </div>
      <div class="kpi kpi-outstanding">
        <div class="kpi-label">Outstanding</div>
        <div class="kpi-value">${esc(formatCurrency(summary.totalOutstanding, currency))}</div>
        <div class="kpi-hint">${summary.participantsUnpaid} unpaid · ${summary.participantsPending} pending</div>
      </div>
      <div class="kpi kpi-overdue">
        <div class="kpi-label">Overdue</div>
        <div class="kpi-value">${esc(formatCurrency(summary.overdueAmount, currency))}</div>
        <div class="kpi-hint">${summary.overdueBills} bill${summary.overdueBills === 1 ? '' : 's'} past due</div>
      </div>
      <div class="kpi kpi-bills">
        <div class="kpi-label">Bills</div>
        <div class="kpi-value">${summary.totalBills}</div>
        <div class="kpi-hint">${summary.activeBills} active · ${summary.completedBills} complete · ${summary.cancelledBills} cancelled</div>
      </div>
    </div>`;

  // ── Monthly performance ──────────────────────────────────────────────────
  const maxMonthTotal = Math.max(...history.map((m) => m.totalBilled), 1);
  const monthlyBars = history
    .map((m) => {
      const colW = (m.totalBilled / maxMonthTotal) * 100;
      const colCollected = m.totalBilled > 0 ? (m.collected / m.totalBilled) * 100 : 0;
      return `
        <div class="mb-row">
          <div class="mb-label">${esc(m.label)} ${String(m.year).slice(-2)}</div>
          <div class="mb-track"><div class="mb-fill" style="width:${colW.toFixed(1)}%">
            <div class="mb-fill-paid" style="width:${colCollected.toFixed(1)}%"></div>
          </div></div>
          <div class="mb-val">${esc(formatCurrency(m.totalBilled, currency))}</div>
        </div>`;
    })
    .join('');

  const monthlyTable = `
    <table class="data">
      <thead>
        <tr>
          <th>Month</th>
          <th class="num">Bills</th>
          <th class="num">Billed</th>
          <th class="num">Collected</th>
          <th class="num">Outstanding</th>
          <th class="num">Collection</th>
        </tr>
      </thead>
      <tbody>
        ${history
          .map((m) => {
            const rate = m.totalBilled > 0 ? Math.round((m.collected / m.totalBilled) * 100) : 0;
            return `
            <tr>
              <td>${esc(m.label)} ${esc(m.year)}</td>
              <td class="num">${m.billsCreated}</td>
              <td class="num mono">${esc(formatCurrency(m.totalBilled, currency))}</td>
              <td class="num mono">${esc(formatCurrency(m.collected, currency))}</td>
              <td class="num mono">${esc(formatCurrency(m.outstanding, currency))}</td>
              <td class="num">${rate}%</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;

  // ── Category breakdown ───────────────────────────────────────────────────
  const categoryBars =
    cats.length === 0
      ? '<p class="muted">No category data yet.</p>'
      : cats
          .map(
            (c) => `
        <div class="cat-row">
          <div class="cat-label"><span class="cat-dot" style="background:${CATEGORY_COLORS[c.cat]}"></span>${esc(
              CATEGORY_LABELS[c.cat]
            )}</div>
          <div class="cat-track"><div class="cat-fill" style="width:${c.percent ?? 0}%;background:${CATEGORY_COLORS[c.cat]}"></div></div>
          <div class="cat-amount">
            <div class="mono">${esc(formatCurrency(c.amount, currency))}</div>
            <div class="muted-sm">${c.percent ?? 0}%</div>
          </div>
        </div>`
          )
          .join('');

  const categoryTable =
    cats.length === 0
      ? ''
      : `
    <table class="data">
      <thead>
        <tr>
          <th>Category</th>
          <th class="num">Total</th>
          <th class="num">Collected</th>
          <th class="num">Outstanding</th>
          <th class="num">Share</th>
        </tr>
      </thead>
      <tbody>
        ${cats
          .map(
            (c) => `
          <tr>
            <td><span class="cat-dot" style="background:${CATEGORY_COLORS[c.cat]}"></span>${esc(CATEGORY_LABELS[c.cat])}</td>
            <td class="num mono">${esc(formatCurrency(c.amount, currency))}</td>
            <td class="num mono">${esc(formatCurrency(c.collected ?? 0, currency))}</td>
            <td class="num mono">${esc(formatCurrency(c.outstanding ?? 0, currency))}</td>
            <td class="num">${c.percent ?? 0}%</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`;

  // ── Outstanding bills ────────────────────────────────────────────────────
  const outstanding = bills
    .filter((b) => b.status === 'active' && b.participants.some((p) => !p.isPaid))
    .map((b) => {
      const due = new Date(b.dueDate);
      const days = differenceInDays(due, now);
      const unpaidAmount = b.participants.filter((p) => !p.isPaid).reduce((s, p) => s + p.amount, 0);
      const unpaidNames = b.participants
        .filter((p) => !p.isPaid)
        .map((p) => p.name)
        .join(', ');
      return { b, days, unpaidAmount, unpaidNames, status: days < 0 ? 'OVERDUE' : 'UPCOMING' };
    })
    .sort((a, b) => a.days - b.days);

  const outstandingSection =
    outstanding.length === 0
      ? '<div class="callout callout-good">🎉 No outstanding bills — everything is collected or completed.</div>'
      : `
    <div class="callout">
      <strong>${outstanding.length}</strong> bill${outstanding.length === 1 ? '' : 's'} need attention — ${esc(formatCurrency(
        outstanding.reduce((s, o) => s + o.unpaidAmount, 0),
        currency
      ))} still to collect.
    </div>
    <table class="data">
      <thead>
        <tr>
          <th>Bill</th>
          <th>Status</th>
          <th>Due</th>
          <th class="num">Days</th>
          <th class="num">Outstanding</th>
          <th>Awaiting</th>
        </tr>
      </thead>
      <tbody>
        ${outstanding
          .map(
            ({ b, days, unpaidAmount, unpaidNames, status }) => `
          <tr class="${status === 'OVERDUE' ? 'row-overdue' : ''}">
            <td>
              <div class="bill-title">${esc(b.title)}</div>
              <div class="muted-sm">${esc(b.invoiceNumber ?? b.id.slice(0, 8))}</div>
            </td>
            <td>${statusBadge(status)}</td>
            <td class="mono">${esc(format(new Date(b.dueDate), 'dd MMM yyyy'))}</td>
            <td class="num">${days < 0 ? `+${Math.abs(days)}` : days}</td>
            <td class="num mono">${esc(formatCurrency(unpaidAmount, currency))}</td>
            <td class="awaiting">${esc(unpaidNames)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`;

  // ── All bills detail ─────────────────────────────────────────────────────
  const billsTable = `
    <table class="data">
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Bill</th>
          <th>Category</th>
          <th>Due</th>
          <th class="num">Paid / Total</th>
          <th class="num">Collected</th>
          <th class="num">Outstanding</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${bills
          .slice()
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((b) => {
            const total = b.participants.reduce((s, p) => s + p.amount, 0);
            const collected = b.participants.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
            const outstanding = total - collected;
            const paidCount = b.participants.filter((p) => p.isPaid).length;
            return `
            <tr>
              <td class="mono small">${esc(b.invoiceNumber ?? b.id.slice(0, 8))}</td>
              <td>
                <div class="bill-title">${esc(b.title)}</div>
                ${b.isRecurring ? `<div class="muted-sm">Recurring ${esc(b.isRecurring)}</div>` : ''}
              </td>
              <td>${esc(CATEGORY_LABELS[(b.category ?? 'other') as Category])}</td>
              <td class="mono small">${esc(format(new Date(b.dueDate), 'dd MMM yyyy'))}</td>
              <td class="num">${paidCount} / ${b.participants.length}</td>
              <td class="num mono">${esc(formatCurrency(collected, currency))}</td>
              <td class="num mono">${esc(formatCurrency(outstanding, currency))}</td>
              <td>${statusBadge(b.status)}</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>`;

  // ── Top reliable payers ──────────────────────────────────────────────────
  const reliabilitySection =
    reliable.length === 0
      ? ''
      : `
    <section class="page-break">
      <h2>Top payers</h2>
      <p class="muted">Ranked by on-time payment history.</p>
      <table class="data">
        <thead>
          <tr>
            <th>Name</th>
            <th class="num">Score</th>
            <th class="num">Avg days vs due</th>
            <th>Band</th>
          </tr>
        </thead>
        <tbody>
          ${reliable
            .map(
              (r) => `
            <tr>
              <td>${esc(r.name)}</td>
              <td class="num mono">${r.score}</td>
              <td class="num">${r.avgDays > 0 ? `+${r.avgDays}` : r.avgDays}</td>
              <td><span class="badge" style="background:${r.band.color}1a;color:${r.band.color};border-color:${r.band.color}33">${esc(r.band.label)}</span></td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>
    </section>`;

  // ── Page assembly ────────────────────────────────────────────────────────
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: #0f172a;
    margin: 0;
    font-size: 11px;
    line-height: 1.45;
  }
  .mono { font-family: 'DM Mono', monospace; }
  .small { font-size: 10px; }
  .muted { color: #6b7280; font-size: 11px; }
  .muted-sm { color: #94a3b8; font-size: 9px; margin-top: 2px; }
  .num { text-align: right; }
  .page-break { page-break-before: always; }
  h1 { font-size: 24px; color: #4F46E5; margin: 0 0 4px 0; letter-spacing: -0.5px; }
  h2 { font-size: 15px; color: #1e293b; margin: 24px 0 10px 0; letter-spacing: -0.2px; }
  h2.first { margin-top: 8px; }
  .eyebrow { font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase; color: #6366f1; font-weight: 700; margin-bottom: 4px; }

  /* Header ribbon */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #4F46E5;
    padding-bottom: 14px;
    margin-bottom: 18px;
  }
  .brand { font-weight: 700; font-size: 13px; color: #1e293b; }
  .brand .dot { display: inline-block; width: 9px; height: 9px; background: #4F46E5; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .meta-block { text-align: right; font-size: 10px; color: #64748b; }
  .meta-block strong { color: #0f172a; }

  /* KPI grid */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 12px 0 22px 0;
  }
  .kpi { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #fff; }
  .kpi-collected { background: linear-gradient(135deg, #ecfdf5, #ffffff); border-color: #a7f3d0; }
  .kpi-outstanding { background: linear-gradient(135deg, #fef3c7, #ffffff); border-color: #fde68a; }
  .kpi-overdue { background: linear-gradient(135deg, #fee2e2, #ffffff); border-color: #fecaca; }
  .kpi-bills { background: linear-gradient(135deg, #eef2ff, #ffffff); border-color: #c7d2fe; }
  .kpi-label { font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: #475569; font-weight: 600; }
  .kpi-value { font-family: 'DM Mono', monospace; font-size: 18px; font-weight: 700; margin-top: 4px; color: #0f172a; }
  .kpi-hint { font-size: 9px; color: #64748b; margin-top: 4px; }

  /* Summary card */
  .summary-card { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; background: #fafbff; margin-bottom: 14px; }
  .summary-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #e2e8f0; font-size: 10.5px; }
  .summary-row:last-child { border-bottom: none; }
  .summary-row .k { color: #475569; }
  .summary-row .v { font-family: 'DM Mono', monospace; color: #0f172a; font-weight: 500; }

  /* Monthly bars */
  .mb-row { display: grid; grid-template-columns: 56px 1fr 80px; gap: 8px; align-items: center; padding: 4px 0; }
  .mb-label { font-size: 10px; color: #475569; }
  .mb-track { height: 14px; background: #f1f5f9; border-radius: 4px; overflow: hidden; position: relative; }
  .mb-fill { height: 100%; background: #4F46E5; border-radius: 4px; position: relative; overflow: hidden; }
  .mb-fill-paid { height: 100%; background: #10B981; }
  .mb-val { font-family: 'DM Mono', monospace; font-size: 10px; text-align: right; color: #0f172a; }
  .mb-legend { display: flex; gap: 14px; margin: 8px 0 14px 0; font-size: 9px; color: #64748b; }
  .mb-legend .dot { width: 8px; height: 8px; border-radius: 2px; display: inline-block; margin-right: 4px; vertical-align: middle; }

  /* Category */
  .cat-row { display: grid; grid-template-columns: 130px 1fr 90px; gap: 10px; align-items: center; padding: 6px 0; }
  .cat-label { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: #0f172a; }
  .cat-dot { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
  .cat-track { height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
  .cat-fill { height: 100%; border-radius: 4px; }
  .cat-amount { text-align: right; font-size: 10.5px; }

  /* Data tables */
  table.data { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 6px; }
  table.data th {
    text-align: left;
    padding: 8px 10px;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    font-size: 9px;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    border-bottom: 1px solid #e2e8f0;
  }
  table.data td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  table.data tr:last-child td { border-bottom: none; }
  table.data .bill-title { font-weight: 600; color: #0f172a; }
  table.data .awaiting { color: #475569; font-size: 9px; max-width: 160px; }
  table.data .row-overdue { background: #fef2f2; }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Callouts */
  .callout {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 10px 14px;
    color: #92400e;
    font-size: 10.5px;
    margin-bottom: 10px;
  }
  .callout-good {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #065f46;
  }

  /* Footer */
  .footer {
    margin-top: 36px;
    border-top: 1px solid #e2e8f0;
    padding-top: 10px;
    font-size: 9px;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }
</style>
</head>
<body>

  <div class="header">
    <div>
      <div class="brand"><span class="dot"></span>GoCheck</div>
      <h1>Organizer Report</h1>
      <div class="muted">${esc(organizer)} · ${esc(periodLabel)}</div>
    </div>
    <div class="meta-block">
      <div><strong>Generated</strong></div>
      <div>${esc(todayLong)}</div>
      <div style="margin-top:6px"><strong>Currency</strong> ${esc(currency)}</div>
    </div>
  </div>

  <div class="eyebrow">Executive summary</div>
  ${kpis}

  <div class="summary-card">
    <div class="summary-row"><span class="k">Total billed across all participants</span><span class="v">${esc(formatCurrency(summary.totalBilled, currency))}</span></div>
    <div class="summary-row"><span class="k">Collection rate</span><span class="v">${summary.collectionRate}%</span></div>
    <div class="summary-row"><span class="k">Participants paid / unpaid / pending</span><span class="v">${summary.participantsPaid} / ${summary.participantsUnpaid} / ${summary.participantsPending}</span></div>
    <div class="summary-row"><span class="k">Recurring bills (monthly / yearly)</span><span class="v">${summary.recurringMonthly} / ${summary.recurringYearly}</span></div>
    <div class="summary-row"><span class="k">Overdue bills</span><span class="v">${summary.overdueBills} (${esc(formatCurrency(summary.overdueAmount, currency))})</span></div>
  </div>

  <section class="page-break">
    <h2 class="first">Monthly performance</h2>
    <p class="muted">Last 12 months by due date. Green portion shows collected; the rest is outstanding.</p>
    <div class="mb-legend">
      <span><span class="dot" style="background:#10B981"></span>Collected</span>
      <span><span class="dot" style="background:#4F46E5"></span>Billed (total)</span>
    </div>
    ${monthlyBars}
    <div style="height:14px"></div>
    ${monthlyTable}
  </section>

  <section class="page-break">
    <h2 class="first">Spending by category</h2>
    <p class="muted">How your billed amounts split across categories you tagged.</p>
    ${categoryBars}
    <div style="height:12px"></div>
    ${categoryTable}
  </section>

  <section class="page-break">
    <h2 class="first">Outstanding bills</h2>
    <p class="muted">Action list — bills with at least one unpaid participant, sorted by urgency.</p>
    ${outstandingSection}
  </section>

  <section class="page-break">
    <h2 class="first">All bills</h2>
    <p class="muted">Full ledger of bills in this report, newest first.</p>
    ${billsTable}
  </section>

  ${reliabilitySection}

  <div class="footer">
    <span>GoCheck · Organizer report for ${esc(organizer)}</span>
    <span>${esc(today)}</span>
  </div>
</body>
</html>`;
}

export async function exportPDF(
  bills: Bill[],
  currency: Currency,
  options: ExportOptions = {}
): Promise<void> {
  const html = buildReportHtml(bills, currency, options);
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Export GoCheck Report',
  });
}
