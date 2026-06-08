import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { Envelope } from '../../domain/models/envelope.model';
import { Loan } from '../../domain/models/loan.model';
import { Member } from '../../domain/models/member.model';
import { RecurringEntry } from '../../domain/models/recurring-entry.model';
import { BudgetDashboard } from './budget-dashboard';

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
const env = (p: Partial<Envelope>): Envelope => ({
  id: 'e',
  memberId: null,
  name: 'Env',
  type: 'épargne',
  balance: 0,
  target: null,
  color: '#000',
  dueDay: null,
  ...p,
});
const loan = (p: Partial<Loan>): Loan => ({
  id: 'l',
  memberId: null,
  person: 'P',
  direction: 'lent',
  amount: 0,
  remaining: 0,
  description: '',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
  ...p,
});
const member = (p: Partial<Member>): Member => ({
  id: 'm',
  firstName: 'A',
  lastName: 'B',
  color: null,
  ...p,
});

type Summary = {
  id: string | null;
  totalIncome: number;
  monthlyExpenses: { id: string }[];
  totalMonthlyExpenses: number;
  monthlyAnnualExpenses: number;
  totalSpendings: number;
  remaining: number;
  envelopes: unknown[];
  lentLoans: unknown[];
  borrowedLoans: unknown[];
};

function make(
  opts: {
    members?: Member[];
    entries?: RecurringEntry[];
    envelopes?: Envelope[];
    loans?: Loan[];
  } = {},
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: EnvelopeGateway, useValue: { getAll: () => of(opts.envelopes ?? []) } },
      { provide: LoanGateway, useValue: { getAll: () => of(opts.loans ?? []) } },
      { provide: MemberGateway, useValue: { getAll: () => of(opts.members ?? []) } },
      { provide: RecurringEntryGateway, useValue: { getAll: () => of(opts.entries ?? []) } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(BudgetDashboard, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BudgetDashboard);
  const refs = fixture.componentInstance as unknown as {
    memberManager: () => { open: () => void };
  };
  refs.memberManager = () => ({ open: vi.fn() });
  fixture.detectChanges();
  const cmp = fixture.componentInstance as unknown as { memberSummaries: () => Summary[] };
  return cmp.memberSummaries();
}

describe('BudgetDashboard — caractérisation memberSummaries', () => {
  it('mono-membre : agrège les orphelins, trie les charges mensuelles par jour', () => {
    const summaries = make({
      members: [member({ id: 'm1', firstName: 'Alice', lastName: 'Martin' })],
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
          memberId: 'm1',
          amount: 500,
          dayOfMonth: 10,
          accountId: 'a1',
        }),
        entry({ id: 'e3', type: 'expense', memberId: null, amount: 100, dayOfMonth: 5 }),
        entry({ id: 'a4', type: 'annual_expense', memberId: 'm1', amount: 1200 }),
        entry({ id: 's5', type: 'spending', memberId: 'm1', amount: 60 }),
      ],
      envelopes: [
        env({ id: 'env1', memberId: 'm1', balance: 300 }),
        env({ id: 'env2', memberId: null, balance: 50 }),
      ],
      loans: [
        loan({ id: 'L1', memberId: 'm1', direction: 'lent', remaining: 600 }),
        loan({ id: 'L2', memberId: null, direction: 'borrowed', remaining: 200 }),
      ],
    });

    expect(summaries).toHaveLength(1);
    const s = summaries[0];
    expect(s.id).toBe('m1');
    expect(s.totalIncome).toBe(2000);
    expect(s.monthlyExpenses.map((e) => e.id)).toEqual(['e3', 'e2']);
    expect(s.totalMonthlyExpenses).toBe(600);
    expect(s.monthlyAnnualExpenses).toBe(100);
    expect(s.totalSpendings).toBe(60);
    expect(s.remaining).toBe(1240);
    expect(s.envelopes).toHaveLength(2);
    expect(s.lentLoans).toHaveLength(1);
    expect(s.borrowedLoans).toHaveLength(1);
  });

  it('multi-membres : réclame le partagé par accountId, global en tête pour le résiduel', () => {
    const summaries = make({
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
      envelopes: [env({ id: 'envG', memberId: null, balance: 80 })],
    });

    expect(summaries).toHaveLength(3);
    expect(summaries[0].id).toBeNull();
    expect(summaries[0].totalMonthlyExpenses).toBe(50);
    expect(summaries[0].envelopes).toHaveLength(1);
    const alice = summaries.find((s) => s.id === 'm1')!;
    expect(alice).toBeDefined();
    expect(alice.totalIncome).toBe(2000);
    expect(alice.totalMonthlyExpenses).toBe(100);
    const bob = summaries.find((s) => s.id === 'm2')!;
    expect(bob).toBeDefined();
    expect(bob.totalIncome).toBe(1500);
  });
});
