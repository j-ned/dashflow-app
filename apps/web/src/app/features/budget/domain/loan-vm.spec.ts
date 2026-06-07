import { describe, expect, it } from 'vitest';
import { Loan } from './models/loan.model';
import { LoanTransaction } from './models/loan-transaction.model';
import { HistoryEntry, buildLoanHistories, buildLoanVMs } from './loan-vm';

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'l1',
    memberId: null,
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

function tx(over: Partial<LoanTransaction> = {}): LoanTransaction {
  return { id: 't1', loanId: 'l1', amount: 100, date: '2026-02-01', note: null, ...over };
}

describe('buildLoanHistories', () => {
  it('groupe par prêt, trie date desc, balanceAfter remonte le reste (reverse chrono)', () => {
    const result = buildLoanHistories(
      [loan({ id: 'l1', remaining: 600 })],
      [
        tx({ id: 'old', amount: 100, date: '2026-02-01' }),
        tx({ id: 'recent', amount: 300, date: '2026-04-01' }),
      ],
    );
    const entries = result.get('l1')!;
    expect(entries.map((e) => e.tx.id)).toEqual(['recent', 'old']);
    expect(entries[0].balanceAfter).toBe(600);
    expect(entries[1].balanceAfter).toBe(900);
  });

  it('exclut les transactions à montant 0', () => {
    const result = buildLoanHistories(
      [loan({ id: 'l1' })],
      [tx({ id: 'z', amount: 0 }), tx({ id: 'r', amount: 50 })],
    );
    expect(result.get('l1')!.map((e) => e.tx.id)).toEqual(['r']);
  });

  it('prêt sans transaction → liste vide', () => {
    const result = buildLoanHistories(
      [loan({ id: 'l1' }), loan({ id: 'l2' })],
      [tx({ loanId: 'l1' })],
    );
    expect(result.get('l2')).toEqual([]);
  });
});

const EMPTY = new Map<string, HistoryEntry[]>();
const OPTS = {
  direction: 'lent' as const,
  filterMemberId: null,
  today: '2026-06-15',
  dueSoonLimit: '2026-06-22',
};

describe('buildLoanVMs', () => {
  it('filtre par direction et par membre', () => {
    const vms = buildLoanVMs(
      [
        loan({ id: 'lent1', direction: 'lent', memberId: 'm1' }),
        loan({ id: 'borrowed1', direction: 'borrowed', memberId: 'm1' }),
        loan({ id: 'lent2', direction: 'lent', memberId: 'm2' }),
      ],
      EMPTY,
      { ...OPTS, direction: 'lent', filterMemberId: 'm1' },
    );
    expect(vms.map((v) => v.loan.id)).toEqual(['lent1']);
  });

  it('calcule le statut aux 4 frontières today/dueSoonLimit', () => {
    const vms = buildLoanVMs(
      [
        loan({ id: 'settled', remaining: 0, dueDate: '2026-01-01' }),
        loan({ id: 'overdue', remaining: 100, dueDate: '2026-06-14' }),
        loan({ id: 'dueSoon', remaining: 100, dueDate: '2026-06-20' }),
        loan({ id: 'ongoing', remaining: 100, dueDate: '2026-07-30' }),
        loan({ id: 'noDue', remaining: 100, dueDate: null }),
      ],
      EMPTY,
      OPTS,
    );
    const byId = new Map(vms.map((v) => [v.loan.id, v.status]));
    expect(byId.get('settled')).toBe('settled');
    expect(byId.get('overdue')).toBe('overdue');
    expect(byId.get('dueSoon')).toBe('dueSoon');
    expect(byId.get('ongoing')).toBe('ongoing');
    expect(byId.get('noDue')).toBe('ongoing');
  });

  it('trie par rang de statut (overdue < dueSoon < ongoing < settled) puis échéance puis reste desc', () => {
    const vms = buildLoanVMs(
      [
        loan({ id: 'settled', remaining: 0, dueDate: '2026-01-01' }),
        loan({ id: 'ongoing', remaining: 100, dueDate: '2026-08-01' }),
        loan({ id: 'overdue', remaining: 100, dueDate: '2026-06-01' }),
        loan({ id: 'dueSoon', remaining: 100, dueDate: '2026-06-20' }),
      ],
      EMPTY,
      OPTS,
    );
    expect(vms.map((v) => v.loan.id)).toEqual(['overdue', 'dueSoon', 'ongoing', 'settled']);
  });

  it('calcule repaid et pct, et injecte les entries depuis la map', () => {
    const histories = new Map<string, HistoryEntry[]>([['l1', [{ tx: tx(), balanceAfter: 600 }]]]);
    const vms = buildLoanVMs([loan({ id: 'l1', amount: 1000, remaining: 600 })], histories, OPTS);
    expect(vms[0].repaid).toBe(400);
    expect(vms[0].pct).toBe(40);
    expect(vms[0].entries).toHaveLength(1);
  });
});
