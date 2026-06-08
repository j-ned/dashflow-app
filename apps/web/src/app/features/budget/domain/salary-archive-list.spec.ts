import { describe, expect, it } from 'vitest';
import {
  availableYears,
  filterArchivesByYear,
  importedSpendings,
  previousMonth,
} from './salary-archive-list';
import { SalaryArchive } from './models/salary-archive.model';
import { RecurringEntry } from './models/recurring-entry.model';

const arch = (p: Partial<SalaryArchive>): SalaryArchive => ({
  id: 'a',
  accountId: null,
  month: '2026-01',
  salary: 0,
  totalExpenses: 0,
  totalSpendings: 0,
  spendings: [],
  payslipKey: null,
  ...p,
});
const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'x',
  memberId: null,
  accountId: null,
  toAccountId: null,
  label: '',
  amount: 0,
  type: 'spending',
  dayOfMonth: null,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  ...p,
});

describe('availableYears', () => {
  it('années dédupliquées triées descendantes', () => {
    expect(
      availableYears([
        arch({ month: '2025-03' }),
        arch({ month: '2026-01' }),
        arch({ month: '2025-11' }),
      ]),
    ).toEqual(['2026', '2025']);
  });
});

describe('filterArchivesByYear', () => {
  const all = [arch({ id: 'a', month: '2026-01' }), arch({ id: 'b', month: '2025-12' })];
  it('filtre par année', () => {
    expect(filterArchivesByYear(all, '2025').map((a) => a.id)).toEqual(['b']);
  });
  it('null = tout', () => {
    expect(filterArchivesByYear(all, null)).toHaveLength(2);
  });
});

describe('importedSpendings', () => {
  const entries = [
    entry({
      id: 'e1',
      type: 'spending',
      date: '2026-01-05',
      accountId: 'acc1',
      label: 'Courses',
      amount: 30,
      category: 'food',
    }),
    entry({
      id: 'e2',
      type: 'spending',
      date: '2026-02-05',
      accountId: 'acc1',
      label: 'AutreMois',
      amount: 99,
    }),
    entry({
      id: 'e3',
      type: 'expense',
      date: '2026-01-05',
      accountId: 'acc1',
      label: 'PasSpending',
      amount: 99,
    }),
    entry({
      id: 'e4',
      type: 'spending',
      date: '2026-01-09',
      accountId: 'acc2',
      label: 'AutreCompte',
      amount: 99,
    }),
    entry({
      id: 'e5',
      type: 'spending',
      date: null,
      accountId: 'acc1',
      label: 'SansDate',
      amount: 99,
    }),
  ];
  it('filtre spending + mois + compte, mappe en snapshot', () => {
    const out = importedSpendings(entries, { month: '2026-01', accountId: 'acc1' });
    expect(out).toEqual([{ label: 'Courses', amount: 30, date: '2026-01-05', category: 'food' }]);
  });
  it('sans accountId : tous comptes du mois', () => {
    const out = importedSpendings(entries, { month: '2026-01', accountId: null });
    expect(out.map((s) => s.label).sort()).toEqual(['AutreCompte', 'Courses']);
  });
  it('mois null → vide', () => {
    expect(importedSpendings(entries, { month: null, accountId: 'acc1' })).toEqual([]);
  });
});

describe('previousMonth', () => {
  it('mois précédent, horloge injectée', () => {
    expect(previousMonth(new Date(2026, 2, 15))).toBe('2026-02');
  });
  it('bord janvier → décembre année précédente', () => {
    expect(previousMonth(new Date(2026, 0, 10))).toBe('2025-12');
  });
});
