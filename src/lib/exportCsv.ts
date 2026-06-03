import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format, differenceInDays } from 'date-fns';
import type { Bill, Currency } from '../types';
import {
  organizerSummary,
  monthlyActuals,
  categoryBuckets,
  CATEGORY_LABELS,
  topReliability,
} from './reportsCompute';
import type { Category } from './reportsCompute';

interface ExportOptions {
  organizerName?: string;
}

type Cell = string | number | null | undefined;

function csvEscape(v: Cell): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(cells: Cell[]): string {
  return cells.map(csvEscape).join(',');
}

function section(title: string): string[] {
  return ['', `# ${title}`];
}

function pct(value: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function money(n: number): string {
  return n.toFixed(2);
}

function buildReportCsv(
  bills: Bill[],
  currency: Currency,
  opts: ExportOptions
): string {
  const summary = organizerSummary(bills);
  const history = monthlyActuals(bills, 12);
  const cats = categoryBuckets(bills);
  const reliable = topReliability(bills);
  const generatedAt = format(new Date(), 'yyyy-MM-dd HH:mm');
  const now = new Date();
  const organizer = opts.organizerName ?? 'Organizer';

  const out: string[] = [];

  // ── Header block ──────────────────────────────────────────────────────────
  out.push(row(['GoCheck Organizer Report']));
  out.push(row(['Organizer', organizer]));
  out.push(row(['Generated', generatedAt]));
  out.push(row(['Currency', currency]));
  out.push(row(['Reporting period', format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'), 'to', format(now, 'yyyy-MM-dd')]));

  // ── Executive Summary ────────────────────────────────────────────────────
  out.push(...section('Executive summary'));
  out.push(row(['Metric', 'Value']));
  out.push(row(['Total bills', summary.totalBills]));
  out.push(row(['Active bills', summary.activeBills]));
  out.push(row(['Completed bills', summary.completedBills]));
  out.push(row(['Cancelled bills', summary.cancelledBills]));
  out.push(row(['Total billed', money(summary.totalBilled)]));
  out.push(row(['Total collected', money(summary.totalCollected)]));
  out.push(row(['Total outstanding', money(summary.totalOutstanding)]));
  out.push(row(['Collection rate', `${summary.collectionRate}%`]));
  out.push(row(['Participants — total', summary.participantsTotal]));
  out.push(row(['Participants — paid (confirmed)', summary.participantsPaid]));
  out.push(row(['Participants — unpaid', summary.participantsUnpaid]));
  out.push(row(['Participants — pending review', summary.participantsPending]));
  out.push(row(['Participants — rejected', summary.participantsRejected]));
  out.push(row(['Overdue bills', summary.overdueBills]));
  out.push(row(['Overdue amount', money(summary.overdueAmount)]));
  out.push(row(['Recurring (monthly)', summary.recurringMonthly]));
  out.push(row(['Recurring (yearly)', summary.recurringYearly]));

  // ── Bills overview ────────────────────────────────────────────────────────
  out.push(...section('Bills overview'));
  out.push(
    row([
      'Invoice #',
      'Title',
      'Category',
      'Recurring',
      'Status',
      'Created',
      'Due date',
      'Days to due',
      'Overdue',
      'Total amount',
      'Collected',
      'Outstanding',
      'Participants',
      'Paid',
      'Unpaid',
      'Collection %',
      'Payment method',
    ])
  );
  for (const b of bills) {
    const total = b.participants.reduce((s, p) => s + p.amount, 0);
    const collected = b.participants.filter((p) => p.isPaid).reduce((s, p) => s + p.amount, 0);
    const outstanding = total - collected;
    const paidCount = b.participants.filter((p) => p.isPaid).length;
    const unpaidCount = b.participants.length - paidCount;
    const due = new Date(b.dueDate);
    const days = differenceInDays(due, now);
    const overdue = days < 0 && unpaidCount > 0 && b.status === 'active';
    out.push(
      row([
        b.invoiceNumber ?? b.id.slice(0, 8),
        b.title,
        CATEGORY_LABELS[(b.category ?? 'other') as Category],
        b.isRecurring ?? '',
        b.status,
        format(new Date(b.createdAt), 'yyyy-MM-dd'),
        format(due, 'yyyy-MM-dd'),
        days,
        overdue ? 'Yes' : 'No',
        money(total),
        money(collected),
        money(outstanding),
        b.participants.length,
        paidCount,
        unpaidCount,
        pct(collected, total),
        b.paymentMethod ?? '',
      ])
    );
  }

  // ── Outstanding bills (action list) ───────────────────────────────────────
  const outstanding = bills
    .filter((b) => b.status === 'active' && b.participants.some((p) => !p.isPaid))
    .map((b) => {
      const due = new Date(b.dueDate);
      const days = differenceInDays(due, now);
      const unpaidAmount = b.participants
        .filter((p) => !p.isPaid)
        .reduce((s, p) => s + p.amount, 0);
      const unpaidNames = b.participants
        .filter((p) => !p.isPaid)
        .map((p) => p.name)
        .join('; ');
      return { b, days, unpaidAmount, unpaidNames };
    })
    .sort((a, b) => a.days - b.days);

  out.push(...section(`Outstanding bills (${outstanding.length})`));
  out.push(
    row(['Invoice #', 'Title', 'Due date', 'Status', 'Days overdue', 'Outstanding', 'Unpaid participants'])
  );
  for (const { b, days, unpaidAmount, unpaidNames } of outstanding) {
    out.push(
      row([
        b.invoiceNumber ?? b.id.slice(0, 8),
        b.title,
        format(new Date(b.dueDate), 'yyyy-MM-dd'),
        days < 0 ? 'OVERDUE' : 'UPCOMING',
        days < 0 ? Math.abs(days) : 0,
        money(unpaidAmount),
        unpaidNames,
      ])
    );
  }

  // ── Participants detail ───────────────────────────────────────────────────
  out.push(...section('Participants detail'));
  out.push(
    row([
      'Bill',
      'Invoice #',
      'Name',
      'Email',
      'Phone',
      'Amount',
      'Payment status',
      'Submitted at',
      'Confirmed at',
      'Rejected reason',
    ])
  );
  for (const b of bills) {
    for (const p of b.participants) {
      out.push(
        row([
          b.title,
          b.invoiceNumber ?? b.id.slice(0, 8),
          p.name,
          p.email ?? '',
          p.phone ?? '',
          money(p.amount),
          p.paymentStatus ?? (p.isPaid ? 'confirmed' : 'unpaid'),
          p.submittedAt ? format(new Date(p.submittedAt), 'yyyy-MM-dd HH:mm') : '',
          p.confirmedAt ? format(new Date(p.confirmedAt), 'yyyy-MM-dd HH:mm') : '',
          p.rejectedReason ?? '',
        ])
      );
    }
  }

  // ── Monthly aggregates ────────────────────────────────────────────────────
  out.push(...section('Monthly aggregates (last 12 months, by due date)'));
  out.push(row(['Month', 'Year', 'Bills', 'Total billed', 'Collected', 'Outstanding', 'Collection %']));
  for (const m of history) {
    out.push(
      row([
        m.label,
        m.year,
        m.billsCreated,
        money(m.totalBilled),
        money(m.collected),
        money(m.outstanding),
        pct(m.collected, m.totalBilled),
      ])
    );
  }

  // ── Category breakdown ────────────────────────────────────────────────────
  out.push(...section('Category breakdown'));
  out.push(row(['Category', 'Total', 'Collected', 'Outstanding', 'Share of spend']));
  for (const c of cats) {
    out.push(
      row([
        CATEGORY_LABELS[c.cat],
        money(c.amount),
        money(c.collected ?? 0),
        money(c.outstanding ?? 0),
        `${c.percent ?? 0}%`,
      ])
    );
  }

  // ── Top reliable payers ───────────────────────────────────────────────────
  if (reliable.length > 0) {
    out.push(...section('Top payers (reliability)'));
    out.push(row(['Name', 'Score', 'Avg days vs due', 'Band']));
    for (const r of reliable) {
      out.push(row([r.name, r.score, r.avgDays, r.band.label]));
    }
  }

  out.push('');
  out.push(row([`Report generated by GoCheck · ${generatedAt}`]));

  return out.join('\n');
}

export async function exportCSV(
  bills: Bill[],
  currency: Currency,
  options: ExportOptions = {}
): Promise<void> {
  const csv = buildReportCsv(bills, currency, options);
  const filename = `gocheck-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
  const path = (FileSystem.documentDirectory ?? '') + filename;

  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  await Sharing.shareAsync(path, {
    mimeType: 'text/csv',
    dialogTitle: 'Export GoCheck Report',
  });
}
