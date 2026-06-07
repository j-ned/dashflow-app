import { describe, expect, it } from 'vitest';
import { RecurringEntry } from './models/recurring-entry.model';
import { buildTimelineEvents } from './timeline-builder';

function re(over: Partial<RecurringEntry>): RecurringEntry {
  return {
    id: 'x', memberId: null, accountId: 'a', toAccountId: null, label: 'l', amount: 100,
    type: 'expense', dayOfMonth: 10, date: null, endDate: null, category: null,
    payslipKey: null, autoPost: false, autoPostSince: null, ...over,
  };
}

const BASE = {
  incomes: [] as RecurringEntry[], monthlyExpenses: [] as RecurringEntry[],
  outgoingTransfers: [] as RecurringEntry[], incomingTransfers: [] as RecurringEntry[],
  salaryDay: 5, currentDay: 20,
  accountName: (id: string | null) => (id === 'liv' ? 'Livret A' : null),
  fallbackLabel: 'compte',
};

describe('buildTimelineEvents', () => {
  it('revenu → sign +, dépense → sign -', () => {
    const out = buildTimelineEvents({
      ...BASE, incomes: [re({ id: 'i', type: 'income', dayOfMonth: 5 })],
      monthlyExpenses: [re({ id: 'e', dayOfMonth: 10 })],
    });
    expect(out.find((x) => x.id === 'i')!.sign).toBe('+');
    expect(out.find((x) => x.id === 'e')!.sign).toBe('-');
  });

  it('virement sortant → label « → nom », entrant → « ← nom » avec id+"-in"', () => {
    const out = buildTimelineEvents({
      ...BASE,
      outgoingTransfers: [re({ id: 'o', type: 'transfer', toAccountId: 'liv', label: 'Épargne', dayOfMonth: 8 })],
      incomingTransfers: [re({ id: 'in', type: 'transfer', accountId: 'liv', label: 'Reçu', dayOfMonth: 9 })],
    });
    expect(out.find((x) => x.id === 'o')!.label).toBe('→ Livret A — Épargne');
    expect(out.find((x) => x.id === 'in-in')!.label).toBe('← Livret A — Reçu');
  });

  it('libellé de repli quand accountName renvoie null', () => {
    const out = buildTimelineEvents({
      ...BASE, outgoingTransfers: [re({ id: 'o', type: 'transfer', toAccountId: 'zzz', label: 'X' })],
    });
    expect(out[0].label).toBe('→ compte — X');
  });

  it('tri par cycle de paie (salaire 25 : 25,1,24)', () => {
    const days = buildTimelineEvents({
      ...BASE, salaryDay: 25,
      monthlyExpenses: [re({ id: 'd24', dayOfMonth: 24 }), re({ id: 'd1', dayOfMonth: 1 }), re({ id: 'd25', dayOfMonth: 25 })],
    }).map((x) => x.day);
    expect(days).toEqual([25, 1, 24]);
  });

  it('ignore les revenus sans dayOfMonth', () => {
    const out = buildTimelineEvents({ ...BASE, incomes: [re({ id: 'i', type: 'income', dayOfMonth: null })] });
    expect(out.find((x) => x.id === 'i')).toBeUndefined();
  });
});
