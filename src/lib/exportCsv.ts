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
