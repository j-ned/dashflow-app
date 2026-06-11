import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { BankAccount } from './bank-account';

type Cmp = {
  confirmedBalance: () => number;
  projectedBalance: () => number;
  monthlyOutflowRows: () => { id: string; type: string }[];
  savingsTransfersTotal: () => number;
  totalMonthlyExpenses: () => number;
  incomingTransfers: () => { id: string }[];
};

const ACCOUNTS = [
  { id: 'a', name: 'Courant', type: 'courant', initialBalance: 1000, color: null, dotColor: null },
];

function makeComponent(
  opts: {
    entries?: unknown[];
    txs?: unknown[];
    accounts?: unknown[];
    createImpl?: (accountId: string, body: Record<string, unknown>) => Observable<unknown>;
    entryCreateImpl?: (data: Record<string, unknown>) => Observable<unknown>;
    updateImpl?: (id: string, data: { accountId: string }) => Observable<unknown>;
    entryDeleteImpl?: (id: string) => Observable<unknown>;
    accountDeleteImpl?: () => Observable<unknown>;
    choose?: () => Promise<'confirm' | 'alternative' | 'cancel'>;
    toaster?: { success: () => void; error: () => void; info: () => void };
  } = {},
) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      {
        provide: RecurringEntryGateway,
        useValue: {
          getAll: () => of(opts.entries ?? []),
          create: opts.entryCreateImpl ?? ((d: Record<string, unknown>) => of({ ...d, id: 'new' })),
          update: opts.updateImpl ?? (() => of({})),
          delete: opts.entryDeleteImpl ?? (() => of(undefined)),
        },
      },
      {
        provide: BankAccountGateway,
        useValue: {
          getAll: () => of(opts.accounts ?? ACCOUNTS),
          delete: opts.accountDeleteImpl ?? (() => of(undefined)),
        },
      },
      { provide: MemberGateway, useValue: { getAll: () => of([]) } },
      { provide: SalaryArchiveGateway, useValue: { getAll: () => of([]) } },
      {
        provide: AccountTransactionGateway,
        useValue: { getAll: () => of(opts.txs ?? []), create: opts.createImpl ?? (() => of({})) },
      },
      {
        provide: Toaster,
        useValue: opts.toaster ?? { success: vi.fn(), error: vi.fn(), info: vi.fn() },
      },
      {
        provide: ConfirmService,
        useValue: {
          ask: () => of(true),
          confirm: () => Promise.resolve(true),
          delete: () => Promise.resolve(true),
          choose: opts.choose ?? (() => Promise.resolve('cancel')),
        },
      },
      {
        provide: TranslocoService,
        useValue: {
          translate: (k: string) => k,
          getActiveLang: () => 'fr',
          events$: of({ type: 'translationLoadSuccess' }),
        },
      },
    ],
  });
  TestBed.overrideComponent(BankAccount, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BankAccount);
  fixture.detectChanges();
  return fixture.componentInstance as unknown as Cmp;
}

describe('BankAccount — prélèvement vers livret', () => {
  const ACCS = [
    {
      id: 'a',
      name: 'Courant',
      type: 'courant',
      initialBalance: 1000,
      color: null,
      dotColor: null,
    },
    {
      id: 'liv',
      name: 'Livret A',
      type: 'épargne',
      initialBalance: 0,
      color: null,
      dotColor: null,
    },
  ];
  const EXPENSE = {
    id: 'e1',
    accountId: 'a',
    toAccountId: null,
    label: 'Netflix',
    amount: 16,
    type: 'expense',
    dayOfMonth: 10,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    memberId: null,
    autoPost: false,
    autoPostSince: null,
  };
  const SAVING = {
    id: 't1',
    accountId: 'a',
    toAccountId: 'liv',
    label: 'Épargne',
    amount: 200,
    type: 'transfer',
    dayOfMonth: 5,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    memberId: null,
    autoPost: false,
    autoPostSince: null,
  };
  const OUT_COURANT = {
    id: 't2',
    accountId: 'a',
    toAccountId: 'b2',
    label: 'Vers courant 2',
    amount: 50,
    type: 'transfer',
    dayOfMonth: 8,
    date: null,
    endDate: null,
    category: null,
    payslipKey: null,
    memberId: null,
    autoPost: false,
    autoPostSince: null,
  };

  it('inclut les virements récurrents sortants dans les lignes de la colonne', () => {
    const cmp = makeComponent({ entries: [EXPENSE, SAVING], accounts: ACCS });
    const ids = cmp.monthlyOutflowRows().map((r) => r.id);
    expect(ids).toContain('e1');
    expect(ids).toContain('t1');
  });

  it('exclut les virements du total des dépenses (consommation seule)', () => {
    const cmp = makeComponent({ entries: [EXPENSE, SAVING], accounts: ACCS });
    expect(cmp.totalMonthlyExpenses()).toBe(16);
  });

  it("somme dans 'dont épargne' uniquement les virements vers un compte épargne", () => {
    const cmp = makeComponent({ entries: [EXPENSE, SAVING, OUT_COURANT], accounts: ACCS });
    expect(cmp.savingsTransfersTotal()).toBe(200);
  });

  it('expose les virements entrants pour le panneau quand on consulte le livret', () => {
    const cmp = makeComponent({ entries: [SAVING], accounts: ACCS });
    (
      cmp as unknown as { store: { selectAccount: (id: string | null) => void } }
    ).store.selectAccount('liv');
    expect(cmp.incomingTransfers().map((e) => e.id)).toEqual(['t1']);
  });
});

describe('BankAccount — solde projeté', () => {
  const RENT = {
    id: 'r1',
    accountId: 'a',
    label: 'Loyer',
    amount: 800,
    type: 'expense' as const,
    dayOfMonth: 5,
    date: null,
    endDate: null,
    toAccountId: null,
    category: null,
    memberId: null,
    payslipKey: null,
  };

  it('projeté = confirmé + delta des récurrences (zéro transaction réelle)', () => {
    const cmp = makeComponent({ entries: [RENT] });
    expect(cmp.confirmedBalance()).toBe(1000);
    expect(cmp.projectedBalance()).toBe(200); // 1000 − 800
  });

  it('une récurrence postée (transaction réelle de même recurringEntryId ce mois) est exclue du delta', () => {
    const month = new Date().toISOString().slice(0, 7);
    // Daté au 1er du mois : toujours ≤ aujourd'hui (compté dans confirmedBalance) ET même mois (détecté posté).
    const posted = {
      id: 'tx',
      accountId: 'a',
      amount: 800,
      direction: 'expense',
      toAccountId: null,
      date: `${month}-01`,
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'r1',
    };
    const cmp = makeComponent({ entries: [RENT], txs: [posted] });
    expect(cmp.confirmedBalance()).toBe(200); // 1000 − 800 (dépense réelle)
    expect(cmp.projectedBalance()).toBe(200); // delta = 0 (loyer posté, exclu)
  });
});

describe('BankAccount — solde confirmé', () => {
  it('confirmedBalance = solde initial quand aucune transaction réelle', () => {
    expect(makeComponent().confirmedBalance()).toBe(1000);
  });

  it('confirmedBalance reflète les transactions réelles (initial + revenu − dépense)', () => {
    const txs = [
      {
        id: 't1',
        accountId: 'a',
        amount: 200,
        direction: 'income',
        toAccountId: null,
        date: '2000-01-01',
        category: null,
        note: null,
        memberId: null,
        recurringEntryId: null,
      },
      {
        id: 't2',
        accountId: 'a',
        amount: 50,
        direction: 'expense',
        toAccountId: null,
        date: '2000-01-02',
        category: null,
        note: null,
        memberId: null,
        recurringEntryId: null,
      },
    ];
    expect(makeComponent({ txs }).confirmedBalance()).toBe(1150);
  });
});

describe('BankAccount — échéances à confirmer', () => {
  const month = new Date().toISOString().slice(0, 7);
  const RENT = {
    id: 'r1',
    accountId: 'a',
    label: 'Loyer',
    amount: 800,
    type: 'expense',
    dayOfMonth: 1,
    date: null,
    endDate: null,
    toAccountId: null,
    category: null,
    memberId: null,
    payslipKey: null,
  };

  it('pendingCharges inclut une dépense récurrente échue et non postée', () => {
    const cmp = makeComponent({ entries: [RENT] }) as unknown as {
      pendingCharges: () => unknown[];
    };
    expect(cmp.pendingCharges().length).toBe(1);
  });

  it('pendingCharges exclut une récurrence déjà postée ce mois', () => {
    const posted = {
      id: 'tx',
      accountId: 'a',
      amount: 800,
      direction: 'expense',
      toAccountId: null,
      date: `${month}-01`,
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'r1',
    };
    const cmp = makeComponent({ entries: [RENT], txs: [posted] }) as unknown as {
      pendingCharges: () => unknown[];
    };
    expect(cmp.pendingCharges().length).toBe(0);
  });

  it("ignoreCharge retire l'échéance de la liste", () => {
    const cmp = makeComponent({ entries: [RENT] }) as unknown as {
      pendingCharges: () => unknown[];
      ignoreCharge: (id: string) => void;
    };
    expect(cmp.pendingCharges().length).toBe(1);
    cmp.ignoreCharge('r1');
    expect(cmp.pendingCharges().length).toBe(0);
  });

  // Régression : une récurrence orpheline (son compte a été supprimé → accountId mis à null
  // par le `onDelete: 'set null'`) ne doit JAMAIS être proposée à la confirmation : la table
  // transactions exige un compte non-null, donc poster une telle échéance plantait en 500
  // (avalé par le subscribe → « tu cliques ça fait rien »). Visible en vue « Tous les comptes ».
  it("confirmCharge affiche un toast d'erreur si la création échoue (plus de silence)", () => {
    let errored = false;
    const cmp = makeComponent({
      entries: [RENT],
      createImpl: () => throwError(() => ({ status: 500 })),
      toaster: {
        success: vi.fn(),
        error: () => {
          errored = true;
        },
        info: vi.fn(),
      },
    }) as unknown as { confirmCharge: (id: string, amount: number) => void };
    cmp.confirmCharge('r1', 800);
    expect(errored).toBe(true);
  });

  it('pendingCharges exclut une récurrence orpheline (accountId null, vue tous comptes)', () => {
    const ORPHAN = { ...RENT, id: 'orphan', accountId: null };
    const cmp = makeComponent({ entries: [ORPHAN] }) as unknown as {
      pendingCharges: () => unknown[];
      store: { selectedAccountId: { set: (v: string | null) => void } };
    };
    cmp.store.selectedAccountId.set(null); // vue « Tous les comptes » → filteredEntries renvoie tout
    expect(cmp.pendingCharges().length).toBe(0);
  });
});

describe('BankAccount — récurrences orphelines', () => {
  const ORPHAN = {
    id: 'o1',
    accountId: null,
    label: 'Netflix',
    amount: 15,
    type: 'expense',
    dayOfMonth: 5,
    date: null,
    endDate: null,
    toAccountId: null,
    category: null,
    memberId: null,
    payslipKey: null,
  };

  it('orphanEntries liste les récurrences sans compte', () => {
    const withAccount = { ...ORPHAN, id: 'r1', accountId: 'a' };
    const cmp = makeComponent({ entries: [ORPHAN, withAccount] }) as unknown as {
      orphanEntries: () => unknown[];
    };
    expect(cmp.orphanEntries().length).toBe(1);
  });

  it('reassignEntry appelle update avec le compte cible et toast succès', () => {
    let updatedWith: { id: string; accountId: string } | null = null;
    let ok = false;
    const cmp = makeComponent({
      entries: [ORPHAN],
      updateImpl: (id: string, data: { accountId: string }) => {
        updatedWith = { id, accountId: data.accountId };
        return of({});
      },
      toaster: {
        success: () => {
          ok = true;
        },
        error: vi.fn(),
        info: vi.fn(),
      },
    }) as unknown as { reassignEntry: (id: string, accountId: string) => void };
    cmp.reassignEntry('o1', 'a');
    expect(updatedWith).toEqual({ id: 'o1', accountId: 'a' });
    expect(ok).toBe(true);
  });

  it('reassignEntry toast erreur si update échoue', () => {
    let errored = false;
    const cmp = makeComponent({
      entries: [ORPHAN],
      updateImpl: () => throwError(() => ({ status: 500 })),
      toaster: {
        success: vi.fn(),
        error: () => {
          errored = true;
        },
        info: vi.fn(),
      },
    }) as unknown as { reassignEntry: (id: string, accountId: string) => void };
    cmp.reassignEntry('o1', 'a');
    expect(errored).toBe(true);
  });
});

describe('BankAccount — échéances manuelles', () => {
  it('exclut les récurrences auto-pointées des échéances manuelles', () => {
    const auto = {
      id: 'r9',
      accountId: 'a',
      label: 'Épargne',
      amount: 100,
      type: 'transfer' as const,
      dayOfMonth: 1,
      date: null,
      endDate: null,
      toAccountId: 'b',
      category: null,
      memberId: null,
      payslipKey: null,
      autoPost: true,
      autoPostSince: '2026-01',
    };
    const cmp = makeComponent({
      entries: [auto],
      accounts: [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 0 }],
    }) as unknown as { pendingCharges: () => { entry: { id: string } }[] };
    expect(cmp.pendingCharges().some((c) => c.entry.id === 'r9')).toBe(false);
  });
});

describe("BankAccount — auto-pointage à l'ouverture", () => {
  it("crée la transaction d'une échéance auto échue et non pointée", () => {
    const created: { accountId: string; body: Record<string, unknown> }[] = [];
    const auto = {
      id: 'r1',
      accountId: 'a',
      label: 'Loyer',
      amount: 800,
      type: 'expense' as const,
      dayOfMonth: 1,
      date: null,
      endDate: null,
      toAccountId: null,
      category: null,
      memberId: null,
      payslipKey: null,
      autoPost: true,
      autoPostSince: new Date().toISOString().slice(0, 7),
    };
    makeComponent({
      entries: [auto],
      accounts: [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 0 }],
      createImpl: (accountId, body) => {
        created.push({ accountId, body });
        return of({ id: 't1' });
      },
    });
    expect(created).toHaveLength(1);
    expect(created[0].accountId).toBe('a');
    expect(created[0].body).toMatchObject({
      amount: 800,
      direction: 'expense',
      recurringEntryId: 'r1',
      note: 'auto',
    });
  });

  it("ne crée rien si l'échéance auto est déjà pointée ce mois", () => {
    const created: unknown[] = [];
    const month = new Date().toISOString().slice(0, 7);
    const auto = {
      id: 'r1',
      accountId: 'a',
      label: 'Loyer',
      amount: 800,
      type: 'expense' as const,
      dayOfMonth: 1,
      date: null,
      endDate: null,
      toAccountId: null,
      category: null,
      memberId: null,
      payslipKey: null,
      autoPost: true,
      autoPostSince: month,
    };
    makeComponent({
      entries: [auto],
      accounts: [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 0 }],
      txs: [
        {
          id: 't0',
          accountId: 'a',
          amount: 800,
          direction: 'expense',
          toAccountId: null,
          date: `${month}-01`,
          category: null,
          note: 'auto',
          memberId: null,
          recurringEntryId: 'r1',
        },
      ],
      createImpl: () => {
        created.push(1);
        return of({ id: 'x' });
      },
    });
    expect(created).toHaveLength(0);
  });
});

describe('BankAccount — virement ponctuel posté immédiatement', () => {
  const ACCS_LIV = [
    {
      id: 'a',
      name: 'Courant',
      type: 'courant',
      initialBalance: 1000,
      color: null,
      dotColor: null,
    },
    {
      id: 'liv',
      name: 'Livret A',
      type: 'épargne',
      initialBalance: 0,
      color: null,
      dotColor: null,
    },
  ];
  const ONE_TIME_PAST = {
    accountId: 'a',
    toAccountId: 'liv',
    label: 'Vers Livret',
    amount: 500,
    type: 'transfer' as const,
    dayOfMonth: null,
    date: '2020-01-15',
    endDate: null,
    category: null,
    memberId: null,
    payslipKey: null,
    autoPost: false,
    autoPostSince: null,
  };

  type PostCmp = {
    createEntry: (d: unknown) => Promise<void>;
    _postIfImmediateOneTimeTransfer: (e: unknown) => Promise<void>;
  };

  it('poste immédiatement la transaction réelle pour un virement ponctuel daté ≤ aujourd’hui', async () => {
    const created: { accountId: string; body: Record<string, unknown> }[] = [];
    const cmp = makeComponent({
      accounts: ACCS_LIV,
      createImpl: (accountId, body) => {
        created.push({ accountId, body });
        return of({ id: 'tx1' });
      },
    }) as unknown as PostCmp;
    await cmp._postIfImmediateOneTimeTransfer({ ...ONE_TIME_PAST, id: 'e-new' });
    expect(created).toHaveLength(1);
    expect(created[0].accountId).toBe('a');
    expect(created[0].body).toMatchObject({
      amount: 500,
      direction: 'transfer',
      toAccountId: 'liv',
      recurringEntryId: 'e-new',
    });
  });

  it('ne poste rien pour un virement ponctuel futur (reste une projection)', async () => {
    const created: unknown[] = [];
    const cmp = makeComponent({
      accounts: ACCS_LIV,
      createImpl: () => {
        created.push(1);
        return of({ id: 'x' });
      },
    }) as unknown as PostCmp;
    await cmp._postIfImmediateOneTimeTransfer({ ...ONE_TIME_PAST, id: 'e2', date: '2999-01-01' });
    expect(created).toHaveLength(0);
  });

  it('ne poste rien si le virement n’a pas de compte source (orphelin, vue tous comptes)', async () => {
    const created: unknown[] = [];
    const cmp = makeComponent({
      accounts: ACCS_LIV,
      createImpl: () => {
        created.push(1);
        return of({ id: 'x' });
      },
    }) as unknown as PostCmp;
    await cmp._postIfImmediateOneTimeTransfer({ ...ONE_TIME_PAST, id: 'e3', accountId: null });
    expect(created).toHaveLength(0);
  });

  it('ne poste rien pour un virement récurrent (dayOfMonth présent)', async () => {
    const created: unknown[] = [];
    const cmp = makeComponent({
      accounts: ACCS_LIV,
      createImpl: () => {
        created.push(1);
        return of({ id: 'x' });
      },
    }) as unknown as PostCmp;
    await cmp._postIfImmediateOneTimeTransfer({
      ...ONE_TIME_PAST,
      id: 'e4',
      dayOfMonth: 5,
      date: null,
    });
    expect(created).toHaveLength(0);
  });

  it('ne double-compte pas dans le projeté du livret un ponctuel déjà posté', () => {
    const month = new Date().toISOString().slice(0, 7);
    const entry = {
      id: 'ot1',
      accountId: 'a',
      toAccountId: 'liv',
      label: 'Vers Livret',
      amount: 500,
      type: 'transfer',
      dayOfMonth: null,
      date: `${month}-02`,
      endDate: null,
      category: null,
      memberId: null,
      payslipKey: null,
      autoPost: false,
      autoPostSince: null,
    };
    const tx = {
      id: 'txot',
      accountId: 'a',
      amount: 500,
      direction: 'transfer',
      toAccountId: 'liv',
      date: `${month}-02`,
      category: null,
      note: null,
      memberId: null,
      recurringEntryId: 'ot1',
    };
    const cmp = makeComponent({ entries: [entry], txs: [tx], accounts: ACCS_LIV }) as unknown as {
      confirmedBalance: () => number;
      projectedBalance: () => number;
      store: { selectAccount: (id: string | null) => void };
    };
    cmp.store.selectAccount('liv');
    expect(cmp.confirmedBalance()).toBe(500); // livret 0 + virement crédité
    expect(cmp.projectedBalance()).toBe(500); // pas de double comptage (ponctuel posté exclu du delta)
  });
});
