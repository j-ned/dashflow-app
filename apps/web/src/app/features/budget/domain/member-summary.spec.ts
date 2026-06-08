import { describe, expect, it } from 'vitest';
import { buildMemberSummaries } from './member-summary';
import { Envelope } from './models/envelope.model';
import { Loan } from './models/loan.model';
import { Member } from './models/member.model';
import { RecurringEntry } from './models/recurring-entry.model';

const CLOCK = { currentMonth: '2026-06', today: 15 };
const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'x',
  memberId: null,
  accountId: null,
  toAccountId: null,
  label: '',
  amount: 0,
  type: 'expense',
  dayOfMonth: null,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  ...p,
});
const member = (p: Partial<Member>): Member => ({
  id: 'm',
  firstName: 'A',
  lastName: 'B',
  color: null,
  ...p,
});
const base = {
  envelopes: [] as Envelope[],
  loans: [] as Loan[],
  globalLabel: 'GLOBAL',
  globalInitials: 'GL',
};

describe('buildMemberSummaries', () => {
  it('mono-membre : orphelins réclamés, tri des charges, totaux et reste', () => {
    const out = buildMemberSummaries(
      {
        ...base,
        members: [member({ id: 'm1', firstName: 'Alice', lastName: 'Martin' })],
        entries: [
          entry({ id: 'i1', type: 'income', memberId: 'm1', amount: 2000, dayOfMonth: 25 }),
          entry({ id: 'e2', type: 'expense', memberId: 'm1', amount: 500, dayOfMonth: 5 }),
          entry({ id: 'e3', type: 'expense', memberId: null, amount: 100, dayOfMonth: 10 }),
          entry({ id: 'a4', type: 'annual_expense', memberId: 'm1', amount: 1200 }),
          entry({ id: 's5', type: 'spending', memberId: 'm1', amount: 60 }),
        ],
      },
      CLOCK,
    );

    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('m1');
    expect(out[0].label).toBe('Alice Martin');
    expect(out[0].initials).toBe('AM');
    expect(out[0].monthlyExpenses.map((e) => e.id)).toEqual(['e2', 'e3']);
    expect(out[0].totalIncome).toBe(2000);
    expect(out[0].totalMonthlyExpenses).toBe(600);
    expect(out[0].monthlyAnnualExpenses).toBe(100);
    expect(out[0].totalSpendings).toBe(60);
    expect(out[0].remaining).toBe(1240);
  });

  it('multi-membres : partagé réclamé par accountId, global en tête, labels injectés', () => {
    const out = buildMemberSummaries(
      {
        ...base,
        members: [
          member({ id: 'm1', firstName: 'Alice', lastName: 'Martin' }),
          member({ id: 'm2', firstName: 'Bob', lastName: 'Durand' }),
        ],
        entries: [
          entry({
            id: 'i1',
            type: 'income',
            memberId: 'm1',
            amount: 2000,
            dayOfMonth: 25,
            accountId: 'a1',
          }),
          entry({
            id: 'e2',
            type: 'expense',
            memberId: null,
            amount: 100,
            dayOfMonth: 10,
            accountId: 'a1',
          }),
          entry({ id: 'e3', type: 'expense', memberId: null, amount: 50, dayOfMonth: 3 }),
          entry({
            id: 'i4',
            type: 'income',
            memberId: 'm2',
            amount: 1500,
            dayOfMonth: 28,
            accountId: 'a2',
          }),
        ],
      },
      CLOCK,
    );

    expect(out).toHaveLength(3);
    expect(out[0].id).toBeNull();
    expect(out[0].label).toBe('GLOBAL');
    expect(out[0].initials).toBe('GL');
    expect(out[0].totalMonthlyExpenses).toBe(50);
    expect(out.find((s) => s.id === 'm1')!.totalMonthlyExpenses).toBe(100);
    expect(out.find((s) => s.id === 'm2')!.totalIncome).toBe(1500);
  });

  it('filtre les entrées inactives via endDate < currentMonth', () => {
    const out = buildMemberSummaries(
      {
        ...base,
        members: [member({ id: 'm1' })],
        entries: [
          entry({ id: 'old', type: 'income', memberId: 'm1', amount: 999, endDate: '2026-05' }),
          entry({ id: 'cur', type: 'income', memberId: 'm1', amount: 10, endDate: '2026-06' }),
        ],
      },
      CLOCK,
    );
    expect(out[0].incomes.map((e) => e.id)).toEqual(['cur']);
    expect(out[0].totalIncome).toBe(10);
  });

  it('isExpensePassed reflète le cycle salaire (salaire 25, aujourd’hui 15)', () => {
    const out = buildMemberSummaries(
      {
        ...base,
        members: [member({ id: 'm1' })],
        entries: [entry({ id: 'i', type: 'income', memberId: 'm1', amount: 1, dayOfMonth: 25 })],
      },
      CLOCK,
    );
    const after25 = entry({ dayOfMonth: 28 });
    const beforeToday = entry({ dayOfMonth: 10 });
    const between = entry({ dayOfMonth: 20 });
    expect(out[0].isExpensePassed(after25)).toBe(true);
    expect(out[0].isExpensePassed(beforeToday)).toBe(true);
    expect(out[0].isExpensePassed(between)).toBe(false);
  });
});
