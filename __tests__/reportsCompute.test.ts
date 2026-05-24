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
    const paid = subDays(due, 2);
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
    const paid = addDays(due, 4);
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

// ── buildInsight ─────────────────────────────────────────────────────────────

describe('buildInsight', () => {
  it('returns null for empty data', () => {
    expect(buildInsight([], 'MYR')).toBeNull();
  });

  it('returns no-recurring copy when recurringTotal is 0', () => {
    const data = [
      { label: 'Jun', year: 2026, monthIndex: 5, recurring: 0, expected: 1000 },
      { label: 'Jul', year: 2026, monthIndex: 6, recurring: 0, expected: 500 },
      { label: 'Aug', year: 2026, monthIndex: 7, recurring: 0, expected: 700 },
    ];
    const result = buildInsight(data, 'MYR');
    expect(result).toContain('average monthly volume');
  });

  it('returns subscription-audit copy when recurring > 60% of total', () => {
    const data = [
      { label: 'Jun', year: 2026, monthIndex: 5, recurring: 800, expected: 100 },
      { label: 'Jul', year: 2026, monthIndex: 6, recurring: 800, expected: 100 },
      { label: 'Aug', year: 2026, monthIndex: 7, recurring: 800, expected: 100 },
    ];
    const result = buildInsight(data, 'MYR');
    expect(result).toContain('recurring');
    expect(result).toContain('auditing');
  });

  it('returns heads-up copy when peak is more than 1.5x the median', () => {
    const data = [
      { label: 'Jun', year: 2026, monthIndex: 5, recurring: 100, expected: 5000 },
      { label: 'Jul', year: 2026, monthIndex: 6, recurring: 100, expected: 200 },
      { label: 'Aug', year: 2026, monthIndex: 7, recurring: 100, expected: 200 },
    ];
    const result = buildInsight(data, 'MYR');
    expect(result).toContain('Heads up');
  });

  it('returns default copy when peak is not dramatically higher than median', () => {
    const data = [
      { label: 'Jun', year: 2026, monthIndex: 5, recurring: 100, expected: 400 },
      { label: 'Jul', year: 2026, monthIndex: 6, recurring: 100, expected: 350 },
      { label: 'Aug', year: 2026, monthIndex: 7, recurring: 100, expected: 380 },
    ];
    const result = buildInsight(data, 'MYR');
    expect(result).toContain('highest projected month');
  });
});
