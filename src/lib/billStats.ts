import type { Bill } from '../types';

export interface BillStats {
  paidCount: number;
  totalCount: number;
  collected: number;
  remaining: number;
  pct: number;
  done: boolean;
  daysToDue: number;
  overdue: boolean;
}

export function getBillStats(bill: Bill): BillStats {
  const now = new Date();
  const paidCount = bill.participants.filter((p) => p.isPaid).length;
  const totalCount = bill.participants.length;
  const collected = bill.participants
    .filter((p) => p.isPaid)
    .reduce((s, p) => s + p.amount, 0);
  const remaining = bill.totalAmount - collected;
  const pct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const done = pct === 100;
  const daysToDue = Math.round(
    (new Date(bill.dueDate).getTime() - now.getTime()) / 86400000
  );
  const overdue = daysToDue < 0 && !done;

  return { paidCount, totalCount, collected, remaining, pct, done, daysToDue, overdue };
}
