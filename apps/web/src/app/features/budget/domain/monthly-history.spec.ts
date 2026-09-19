import { describe, expect, it } from 'vitest';
import { AccountTransaction } from './models/account-transaction.model';
import { RecurringEntry } from './models/recurring-entry.model';
import { SalaryArchive } from './models/salary-archive.model';
import { computeMonthRecords, mergeHistory } from './monthly-history';
import { salaryArchiveRemaining } from './salary-archive-remaining';

const CURRENT = '2026-09';

const tx = (id: string, over: Partial<AccountTransaction>): AccountTransaction => ({
  id,
  accountId: 'a',
  amount: 10,
  direction: 'expense',
  toAccountId: null,
  date: '2026-08-05',
  category: null,
  note: null,
  memberId: null,
  recurringEntryId: null,
  ...over,
});

const entry = (id: string, type: RecurringEntry['type'], label: string): RecurringEntry => ({
  id,
  memberId: null,
  accountId: 'a',
  toAccountId: null,
  label,
  amount: 0,
  type,
  dayOfMonth: 1,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  variableAmount: false,
});

const ENTRIES = [
  entry('sal', 'income', 'Salaire'),
  entry('rent', 'expense', 'Loyer'),
  entry('courses', 'spending', 'Courses'),
];

const archive = (month: string, over: Partial<SalaryArchive> = {}): SalaryArchive => ({
  id: `arch-${month}`,
  accountId: 'a',
  month,
  salary: 1921.33,
  totalExpenses: 700,
  totalSpendings: 100,
  spendings: [],
  payslipKey: null,
  ...over,
});

describe('computeMonthRecords', () => {
  const AUGUST = [
    tx('s', { direction: 'income', amount: 2050.4, date: '2026-08-01', recurringEntryId: 'sal' }),
    tx('r', { amount: 600, date: '2026-08-01', recurringEntryId: 'rent', note: 'auto' }),
    tx('c', { amount: 82.15, date: '2026-08-12', recurringEntryId: 'courses' }),
    tx('adj', { amount: 3.1, date: '2026-08-20', note: 'Ajustement : écart avec la banque' }),
    tx('v', { direction: 'transfer', amount: 200, toAccountId: 'liv', date: '2026-08-02' }),
  ];

  it('reconstitue un mois clos : revenu réel, charges fixes, dépenses détaillées', () => {
    const [august] = computeMonthRecords(AUGUST, ENTRIES, CURRENT);
    expect(august).toMatchObject({
      month: '2026-08',
      origin: 'computed',
      salary: 2050.4,
      totalExpenses: 600,
      totalSpendings: 85.25,
    });
    expect(august.spendings.map((s) => s.label)).toEqual([
      'Courses',
      'Ajustement : écart avec la banque',
    ]);
    expect(salaryArchiveRemaining(august)).toBeCloseTo(2050.4 - 600 - 85.25, 2);
  });

  it('détail des dépenses : jamais de clé technique de catégorie, ni de libellé répété', () => {
    const [august] = computeMonthRecords(
      [
        tx('s', { direction: 'income', amount: 2000, date: '2026-08-01' }),
        tx('bare', { amount: 20, category: 'other' }),
        tx('noted', { amount: 30, category: 'food', note: 'Marché' }),
      ],
      ENTRIES,
      CURRENT,
    );
    const bare = august.spendings.find((s) => s.amount === 20)!;
    const noted = august.spendings.find((s) => s.amount === 30)!;
    expect(bare.category).toBeNull();
    expect(bare.label).not.toBe('other');
    expect(noted.label).toBe('Marché');
    expect(noted.category).not.toBe('food');
    expect(noted.category).not.toBeNull();
  });

  it('ignore les virements entre ses propres comptes', () => {
    const [august] = computeMonthRecords(AUGUST, ENTRIES, CURRENT);
    expect(august.totalExpenses + august.totalSpendings).toBeCloseTo(685.25, 2);
  });

  it('ne touche pas au mois en cours : il n’est pas fini', () => {
    const records = computeMonthRecords(
      [tx('s', { direction: 'income', amount: 2000, date: '2026-09-01' })],
      ENTRIES,
      CURRENT,
    );
    expect(records).toEqual([]);
  });

  it('écarte un mois sans revenu saisi : ses opérations sont partielles', () => {
    const records = computeMonthRecords(
      [tx('r', { amount: 600, date: '2026-07-01', recurringEntryId: 'rent' })],
      ENTRIES,
      CURRENT,
    );
    expect(records).toEqual([]);
  });

  it('prélèvement dont la récurrence a été supprimée : reste une charge fixe s’il était automatique', () => {
    const [august] = computeMonthRecords(
      [
        tx('s', { direction: 'income', amount: 2000, date: '2026-08-01' }),
        tx('old', { amount: 40, date: '2026-08-03', recurringEntryId: 'gone', note: 'auto' }),
      ],
      ENTRIES,
      CURRENT,
    );
    expect(august).toMatchObject({ totalExpenses: 40, totalSpendings: 0 });
  });
});

describe('mergeHistory', () => {
  const computedAugust = computeMonthRecords(
    [tx('s', { direction: 'income', amount: 2050.4, date: '2026-08-01' })],
    ENTRIES,
    CURRENT,
  );

  it('le calculé l’emporte sur l’archive du même mois, en gardant sa fiche de paie', () => {
    const merged = mergeHistory(
      [archive('2026-08', { payslipKey: 'payslips/u/aout.pdf' })],
      computedAugust,
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      origin: 'computed',
      salary: 2050.4,
      payslipKey: 'payslips/u/aout.pdf',
      archiveId: 'arch-2026-08',
    });
  });

  it('un mois d’avant les opérations garde son archive manuelle', () => {
    const merged = mergeHistory([archive('2026-03')], computedAugust);
    expect(merged.map((m) => [m.month, m.origin])).toEqual([
      ['2026-03', 'archive'],
      ['2026-08', 'computed'],
    ]);
  });

  it('sans aucune archive : l’historique existe quand même', () => {
    expect(mergeHistory([], computedAugust).map((m) => m.month)).toEqual(['2026-08']);
  });
});
