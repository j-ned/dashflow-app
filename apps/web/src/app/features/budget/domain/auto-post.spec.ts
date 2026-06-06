import { duePostings } from './auto-post';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';

const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'r1', memberId: null, accountId: 'a', toAccountId: null,
  label: 'Loyer', amount: 800, type: 'expense', dayOfMonth: 5,
  date: null, endDate: null, category: null, payslipKey: null,
  autoPost: true, autoPostSince: '2026-06', ...p,
});

const tx = (p: Partial<AccountTransaction>): AccountTransaction => ({
  id: 'x', accountId: 'a', amount: 0, direction: 'expense', toAccountId: null,
  date: '2026-06-01', category: null, note: null, memberId: null, recurringEntryId: null, ...p,
});

const CTX = { currentMonth: '2026-06', currentDay: 10 };

describe('duePostings', () => {
  it('poste une échéance du mois courant dont le jour est passé', () => {
    const res = duePostings([entry({ dayOfMonth: 5 })], [], CTX);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ month: '2026-06', date: '2026-06-05', amount: 800, direction: 'expense' });
  });

  it('ne poste pas une échéance du mois courant dont le jour n\'est pas encore passé', () => {
    expect(duePostings([entry({ dayOfMonth: 20 })], [], CTX)).toEqual([]);
  });

  it('ignore une récurrence non auto-pointée', () => {
    expect(duePostings([entry({ autoPost: false })], [], CTX)).toEqual([]);
  });

  it('ignore une récurrence sans compte ou sans jour', () => {
    expect(duePostings([entry({ accountId: null })], [], CTX)).toEqual([]);
    expect(duePostings([entry({ dayOfMonth: null })], [], CTX)).toEqual([]);
  });

  it('ignore les types non éligibles (spending, annual_expense)', () => {
    expect(duePostings([entry({ type: 'spending' })], [], CTX)).toEqual([]);
    expect(duePostings([entry({ type: 'annual_expense' })], [], CTX)).toEqual([]);
  });

  it('mappe la direction selon le type', () => {
    expect(duePostings([entry({ type: 'income', dayOfMonth: 5 })], [], CTX)[0].direction).toBe('income');
    expect(duePostings([entry({ type: 'transfer', dayOfMonth: 5 })], [], CTX)[0].direction).toBe('transfer');
  });

  it('est idempotent : ignore un mois déjà pointé', () => {
    const posted = [tx({ recurringEntryId: 'r1', date: '2026-06-05' })];
    expect(duePostings([entry({ dayOfMonth: 5 })], posted, CTX)).toEqual([]);
  });

  it('rattrape les mois sautés depuis autoPostSince (un posting par mois)', () => {
    const res = duePostings([entry({ dayOfMonth: 5, autoPostSince: '2026-04' })], [], CTX);
    expect(res.map((r) => r.month)).toEqual(['2026-04', '2026-05', '2026-06']);
    expect(res.map((r) => r.date)).toEqual(['2026-04-05', '2026-05-05', '2026-06-05']);
  });

  it('poste un mois PASSÉ en entier même si le jour est après le jour courant', () => {
    const res = duePostings([entry({ dayOfMonth: 20, autoPostSince: '2026-05' })], [], CTX);
    expect(res.map((r) => r.month)).toEqual(['2026-05']);
  });

  it('ne backfille rien avant autoPostSince', () => {
    const res = duePostings([entry({ dayOfMonth: 5, autoPostSince: '2026-06' })], [], CTX);
    expect(res.map((r) => r.month)).toEqual(['2026-06']);
  });

  it('respecte endDate : pas de posting après le mois de fin', () => {
    const res = duePostings(
      [entry({ dayOfMonth: 5, autoPostSince: '2026-04', endDate: '2026-05-31' })], [], CTX,
    );
    expect(res.map((r) => r.month)).toEqual(['2026-04', '2026-05']);
  });

  it('autoPostSince null → pas de rattrapage, mois courant seulement', () => {
    const res = duePostings([entry({ dayOfMonth: 5, autoPostSince: null })], [], CTX);
    expect(res.map((r) => r.month)).toEqual(['2026-06']);
  });
});
