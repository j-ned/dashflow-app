import {
  autoPostCandidates,
  duplicateAutoPostings,
  duePostings,
  isAutoEntry,
  skipDeletedOccurrence,
  unskipRestoredOccurrence,
  withAutoPost,
} from './auto-post';
import { RecurringEntry } from './models/recurring-entry.model';
import { AccountTransaction } from './models/account-transaction.model';

const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'r1',
  memberId: null,
  accountId: 'a',
  toAccountId: null,
  label: 'Loyer',
  amount: 800,
  type: 'expense',
  dayOfMonth: 5,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: true,
  autoPostSince: '2026-06',
  variableAmount: false,
  skippedMonths: [],
  ...p,
});

const tx = (p: Partial<AccountTransaction>): AccountTransaction => ({
  id: 'x',
  accountId: 'a',
  amount: 0,
  direction: 'expense',
  toAccountId: null,
  date: '2026-06-01',
  category: null,
  note: null,
  memberId: null,
  recurringEntryId: null,
  ...p,
});

const CTX = { currentMonth: '2026-06', currentDay: 10 };

describe('duePostings', () => {
  it('poste une échéance du mois courant dont le jour est passé', () => {
    const res = duePostings([entry({ dayOfMonth: 5 })], [], CTX);
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      month: '2026-06',
      date: '2026-06-05',
      amount: 800,
      direction: 'expense',
    });
  });

  it("ne poste pas une échéance du mois courant dont le jour n'est pas encore passé", () => {
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
    expect(duePostings([entry({ type: 'income', dayOfMonth: 5 })], [], CTX)[0].direction).toBe(
      'income',
    );
    expect(
      duePostings([entry({ type: 'transfer', toAccountId: 'b', dayOfMonth: 5 })], [], CTX)[0]
        .direction,
    ).toBe('transfer');
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
      [entry({ dayOfMonth: 5, autoPostSince: '2026-04', endDate: '2026-05-31' })],
      [],
      CTX,
    );
    expect(res.map((r) => r.month)).toEqual(['2026-04', '2026-05']);
  });

  it('autoPostSince null → pas de rattrapage, mois courant seulement', () => {
    const res = duePostings([entry({ dayOfMonth: 5, autoPostSince: null })], [], CTX);
    expect(res.map((r) => r.month)).toEqual(['2026-06']);
  });
});

describe('isAutoEntry', () => {
  it('true pour un virement quel que soit autoPost', () => {
    expect(isAutoEntry(entry({ type: 'transfer', toAccountId: 'b', autoPost: false }))).toBe(true);
  });

  it('reflète autoPost pour income/expense', () => {
    expect(isAutoEntry(entry({ type: 'expense', autoPost: true }))).toBe(true);
    expect(isAutoEntry(entry({ type: 'expense', autoPost: false }))).toBe(false);
  });
});

describe('duePostings : virements toujours auto', () => {
  it('poste un virement récurrent même si autoPost est false', () => {
    const res = duePostings(
      [
        entry({
          type: 'transfer',
          toAccountId: 'b',
          dayOfMonth: 5,
          autoPost: false,
          autoPostSince: null,
          variableAmount: false,
        }),
      ],
      [],
      CTX,
    );
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ month: '2026-06', date: '2026-06-05', direction: 'transfer' });
  });

  it('une dépense non auto-pointée reste ignorée (non-régression)', () => {
    expect(duePostings([entry({ type: 'expense', autoPost: false })], [], CTX)).toEqual([]);
  });
});

describe('autoPostCandidates', () => {
  it('retient les prélèvements mensuels fixes encore confirmés à la main, et eux seuls', () => {
    const manual = { autoPost: false, autoPostSince: null } as const;
    const entries = [
      entry({ ...manual, id: 'loyer', type: 'expense', accountId: 'a', dayOfMonth: 1 }),
      entry({ id: 'deja-auto', type: 'expense', accountId: 'a', dayOfMonth: 5, autoPost: true }),
      entry({ ...manual, id: 'orphelin', type: 'expense', accountId: null, dayOfMonth: 5 }),
      entry({ ...manual, id: 'sans-jour', type: 'expense', accountId: 'a', dayOfMonth: null }),
      entry({ ...manual, id: 'salaire', type: 'income', accountId: 'a', dayOfMonth: 1 }),
      entry({ ...manual, id: 'taxe', type: 'annual_expense', accountId: 'a', dayOfMonth: 1 }),
    ];
    expect(autoPostCandidates(entries).map((e) => e.id)).toEqual(['loyer']);
  });
});

describe('withAutoPost', () => {
  it("active le pointage à partir du mois courant, sans l'identifiant dans le payload", () => {
    const payload = withAutoPost(
      entry({ id: 'loyer', type: 'expense', dayOfMonth: 1, autoPost: false, autoPostSince: null }),
      '2026-09',
    );
    expect(payload).toMatchObject({ autoPost: true, autoPostSince: '2026-09' });
    expect('id' in payload).toBe(false);
  });

  it("ne rattrape jamais les mois d'avant l'activation", () => {
    const loyer = entry({
      id: 'loyer',
      type: 'expense',
      dayOfMonth: 1,
      autoPost: false,
      autoPostSince: null,
    });
    const automated = { id: 'loyer', ...withAutoPost(loyer, '2026-09') };
    const due = duePostings([automated], [], { currentMonth: '2026-09', currentDay: 19 });
    expect(due.map((d) => d.month)).toEqual(['2026-09']);
  });

  it("conserve une date d'activation déjà figée", () => {
    const payload = withAutoPost(
      entry({ id: 'x', type: 'expense', accountId: 'a', dayOfMonth: 1, autoPostSince: '2026-06' }),
      '2026-09',
    );
    expect(payload.autoPostSince).toBe('2026-06');
  });
});

describe('duePostings — fin de mois', () => {
  it('ramène un jour 31 au dernier jour des mois courts au lieu d’une date inexistante', () => {
    const due = duePostings([entry({ dayOfMonth: 31, autoPostSince: '2026-04' })], [], {
      currentMonth: '2026-06',
      currentDay: 30,
    });
    expect(due.map((d) => d.date)).toEqual(['2026-04-30', '2026-05-31', '2026-06-30']);
  });

  it('poste un jour 30 de février le 28, dès le 28 février', () => {
    const due = duePostings([entry({ dayOfMonth: 30, autoPostSince: '2026-02' })], [], {
      currentMonth: '2026-02',
      currentDay: 28,
    });
    expect(due.map((d) => d.date)).toEqual(['2026-02-28']);
  });
});

describe('duePostings — date de fin', () => {
  it('ne poste pas une échéance du mois de fin tombant après la date de fin', () => {
    const due = duePostings(
      [entry({ dayOfMonth: 20, endDate: '2026-06-10', autoPostSince: '2026-05' })],
      [],
      { currentMonth: '2026-06', currentDay: 25 },
    );
    expect(due.map((d) => d.date)).toEqual(['2026-05-20']);
  });

  it('poste encore une échéance tombant le jour même de la date de fin', () => {
    const due = duePostings(
      [entry({ dayOfMonth: 20, endDate: '2026-06-20', autoPostSince: '2026-06' })],
      [],
      { currentMonth: '2026-06', currentDay: 25 },
    );
    expect(due.map((d) => d.date)).toEqual(['2026-06-20']);
  });
});

describe('duePostings — virements', () => {
  const transfer = (p: Partial<RecurringEntry>) =>
    entry({ type: 'transfer', toAccountId: 'b', autoPostSince: '2026-06', ...p });

  it('ne poste pas un virement dont le compte destinataire a été supprimé', () => {
    expect(duePostings([transfer({ toAccountId: null })], [], CTX)).toEqual([]);
  });

  it('poste un virement dont le destinataire existe', () => {
    expect(duePostings([transfer({})], [], CTX).map((d) => d.date)).toEqual(['2026-06-05']);
  });

  it('rattrape un ancien virement sans mois d’activation depuis sa dernière occurrence postée', () => {
    const due = duePostings(
      [transfer({ autoPost: false, autoPostSince: null })],
      [tx({ recurringEntryId: 'r1', direction: 'transfer', date: '2026-04-05' })],
      CTX,
    );
    expect(due.map((d) => d.date)).toEqual(['2026-05-05', '2026-06-05']);
  });

  it('ne poste que le mois courant pour un ancien virement jamais posté', () => {
    const due = duePostings([transfer({ autoPost: false, autoPostSince: null })], [], CTX);
    expect(due.map((d) => d.date)).toEqual(['2026-06-05']);
  });
});

describe('duePostings — occurrences annulées', () => {
  it('ne recrée pas l’occurrence d’un mois annulé par l’utilisateur', () => {
    const due = duePostings(
      [entry({ autoPostSince: '2026-05', skippedMonths: ['2026-05'] })],
      [],
      CTX,
    );
    expect(due.map((d) => d.month)).toEqual(['2026-06']);
  });
});

describe('skipDeletedOccurrence', () => {
  const posted = tx({ recurringEntryId: 'r1', date: '2026-05-05' });

  it('retient le mois de l’opération supprimée sur une récurrence auto-pointée', () => {
    const next = skipDeletedOccurrence(posted, entry({ skippedMonths: ['2026-01'] }));
    expect(next?.skippedMonths).toEqual(['2026-01', '2026-05']);
  });

  it('retient le mois pour un virement, toujours automatique', () => {
    const next = skipDeletedOccurrence(
      posted,
      entry({ type: 'transfer', toAccountId: 'b', autoPost: false }),
    );
    expect(next?.skippedMonths).toEqual(['2026-05']);
  });

  it.each([
    ['récurrence à confirmer à la main', entry({ autoPost: false })],
    ['mois déjà annulé', entry({ skippedMonths: ['2026-05'] })],
    ['récurrence introuvable', undefined],
  ])('ne change rien : %s', (_label, e) => {
    expect(skipDeletedOccurrence(posted, e)).toBeNull();
  });

  it('ne change rien pour une opération liée à une autre récurrence', () => {
    expect(skipDeletedOccurrence(tx({ recurringEntryId: 'other' }), entry({}))).toBeNull();
  });
});

describe('unskipRestoredOccurrence', () => {
  const restored = tx({ recurringEntryId: 'r1', date: '2026-05-05' });

  it('oublie le mois d’une opération rétablie, pour que le pointage la gère à nouveau', () => {
    const next = unskipRestoredOccurrence(
      restored,
      entry({ skippedMonths: ['2026-01', '2026-05'] }),
    );
    expect(next?.skippedMonths).toEqual(['2026-01']);
  });

  it.each([
    ['mois non retenu', entry({ skippedMonths: ['2026-01'] })],
    ['récurrence introuvable', undefined],
  ])('ne change rien : %s', (_label, e) => {
    expect(unskipRestoredOccurrence(restored, e)).toBeNull();
  });

  it('ne change rien pour une opération liée à une autre récurrence', () => {
    const other = tx({ recurringEntryId: 'other', date: '2026-05-05' });
    expect(unskipRestoredOccurrence(other, entry({ skippedMonths: ['2026-05'] }))).toBeNull();
  });
});

describe('duplicateAutoPostings', () => {
  const posted = (id: string, date: string, recurringEntryId: string | null = 'r1') =>
    tx({ id, date, recurringEntryId });

  it('désigne les copies d’une occurrence postée plusieurs fois, en gardant la plus petite id', () => {
    const dups = duplicateAutoPostings(
      [entry({})],
      [posted('c', '2026-06-05'), posted('a', '2026-06-05'), posted('b', '2026-06-05')],
    );
    expect(dups.map((t) => t.id)).toEqual(['c', 'b']);
  });

  it('désigne la même survivante quel que soit l’ordre de chargement (deux appareils convergent)', () => {
    const one = duplicateAutoPostings(
      [entry({})],
      [posted('a', '2026-06-05'), posted('b', '2026-06-01')],
    );
    const other = duplicateAutoPostings(
      [entry({})],
      [posted('b', '2026-06-01'), posted('a', '2026-06-05')],
    );
    expect([one.map((t) => t.id), other.map((t) => t.id)]).toEqual([['b'], ['b']]);
  });

  it.each([
    ['mois différents', [entry({})], [posted('a', '2026-05-05'), posted('b', '2026-06-05')]],
    [
      'récurrence confirmée à la main',
      [entry({ autoPost: false })],
      [posted('a', '2026-06-05'), posted('b', '2026-06-05')],
    ],
    [
      'opérations hors récurrence',
      [entry({})],
      [posted('a', '2026-06-05', null), posted('b', '2026-06-05', null)],
    ],
  ])('ne désigne rien : %s', (_label, entries, txs) => {
    expect(duplicateAutoPostings(entries, txs)).toEqual([]);
  });
});
