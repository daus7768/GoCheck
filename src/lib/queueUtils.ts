import type { Bill, ReminderRow, ReminderSettings, QueueItem, ReliabilityLabel } from '../types';

export function computeReliability(name: string, bills: Bill[]): ReliabilityLabel | null {
  const history: number[] = [];
  for (const bill of bills) {
    const p = bill.participants.find((pt) => pt.name === name && pt.isPaid && pt.paidAt);
    if (!p?.paidAt) continue;
    const paid = new Date(p.paidAt).getTime();
    const due = new Date(bill.dueDate).getTime();
    const daysLate = Math.round((paid - due) / 86_400_000);
    history.push(daysLate);
  }
  if (history.length === 0) return null;
  const avg = history.reduce((s, d) => s + d, 0) / history.length;
  if (avg < 0) return 'reliable';
  if (Math.round(avg) === 0) return 'on-time';
  if (avg <= 7) return 'slow';
  return 'at-risk';
}

function daysToDue(dueDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

function remindersThisWeek(
  sent: ReminderRow[],
  billId: string,
  participantId: string
): number {
  const weekAgo = Date.now() - 7 * 86_400_000;
  return sent.filter(
    (r) =>
      r.billId === billId &&
      r.participantId === participantId &&
      new Date(r.sentAt).getTime() >= weekAgo
  ).length;
}

export function buildQueueItems(
  bills: Bill[],
  sent: ReminderRow[],
  settings: ReminderSettings,
  organizerId: string
): { items: QueueItem[]; limitReached: QueueItem[] } {
  const items: QueueItem[] = [];
  const limitReached: QueueItem[] = [];

  for (const bill of bills) {
    if (bill.status !== 'active') continue;
    for (const p of bill.participants) {
      // Filter 1: skip paid
      if (settings.skipPaid && p.isPaid) continue;

      // Filter 2: don't nudge the organizer
      if (p.id === organizerId) continue;

      const dtd = daysToDue(bill.dueDate);

      // Filter 3: cadence visibility
      if (settings.cadence === 'smart') {
        const lastSent = sent
          .filter((r) => r.billId === bill.id && r.participantId === p.id)
          .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime())[0];
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        let daysSinceLast = Infinity;
        if (lastSent) {
          const sentDate = new Date(lastSent.sentAt);
          sentDate.setHours(0, 0, 0, 0);
          daysSinceLast = Math.round((todayMidnight.getTime() - sentDate.getTime()) / 86_400_000);
        }
        const showSmart = dtd <= 3 || daysSinceLast >= 3;
        if (!showSmart) continue;
      }

      const item: QueueItem = {
        billId: bill.id,
        billTitle: bill.title,
        participantId: p.id,
        participantName: p.name,
        participantPhone: p.phone,
        participantEmail: p.email,
        participantAvatarColor: p.avatarColor,
        amount: p.amount,
        currency: bill.currency,
        dueDate: bill.dueDate,
        shareLink: bill.shareLink,
        daysToDue: dtd,
      };

      // Filter 4: maxPerWeek
      const weekCount = remindersThisWeek(sent, bill.id, p.id);
      if (weekCount >= settings.maxPerWeek) {
        limitReached.push(item);
      } else {
        items.push(item);
      }
    }
  }

  // Sort: overdue first (negative daysToDue), then soonest due
  items.sort((a, b) => a.daysToDue - b.daysToDue);
  limitReached.sort((a, b) => a.daysToDue - b.daysToDue);

  return { items, limitReached };
}
