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
  <h1>GoCheck — Reports &amp; Insights</h1>
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
