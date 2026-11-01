import { describe, expect, it } from 'vitest';
import { Loan } from './models/loan.model';
import { buildLoanRepaymentEntry } from './loan-repayment-entry';

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    memberId: 'm1',
    person: 'Alice',
    direction: 'lent',
    amount: 1000,
    remaining: 600,
    description: '',
    date: '2026-01-01',
    dueDate: null,
    dueDay: null,
    ...over,
  };
}

const LABELS = { label: 'Remboursement Alice', category: 'Prêt' };
const EVENT = { amount: 100, date: '2026-06-01', accountId: 'acc1', note: null };

describe('buildLoanRepaymentEntry', () => {
  it('prêt accordé (lent) → écriture income, montant entrant', () => {
    const entry = buildLoanRepaymentEntry(loan({ direction: 'lent' }), EVENT, LABELS);
    expect(entry.type).toBe('income');
    expect(entry.amount).toBe(100);
    expect(entry.accountId).toBe('acc1');
    expect(entry.memberId).toBe('m1');
    expect(entry.date).toBe('2026-06-01');
    expect(entry.label).toBe('Remboursement Alice');
    expect(entry.category).toBe('Prêt');
    expect(entry.toAccountId).toBeNull();
    expect(entry.autoPost).toBe(false);
  });

  it('dette remboursée (borrowed) → écriture spending', () => {
    const entry = buildLoanRepaymentEntry(loan({ direction: 'borrowed' }), EVENT, LABELS);
    expect(entry.type).toBe('spending');
  });

  it('date vide → null', () => {
    const entry = buildLoanRepaymentEntry(loan(), { ...EVENT, date: '' }, LABELS);
    expect(entry.date).toBeNull();
  });
});
