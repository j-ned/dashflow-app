import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Toaster } from '@shared/components/toast/toast';
import { Transactions } from './transactions';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';

// Récurrences connues du relevé : sert à nommer les opérations qu'elles ont générées.
const ENTRIES = [{ id: 'rent', label: 'Loyer' }];

describe('Transactions page', () => {
  it('expose le solde confirmé du compte sélectionné', () => {
    const accounts = [
      {
        id: 'a',
        name: 'Courant',
        type: 'courant',
        initialBalance: 100,
        color: null,
        dotColor: null,
      },
    ];
    const txs = [
      {
        id: 't1',
        accountId: 'a',
        amount: 2000,
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
        amount: 500,
        direction: 'expense',
        toAccountId: null,
        date: '2000-01-02',
        category: null,
        note: null,
        memberId: null,
        recurringEntryId: null,
      },
    ];
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
        { provide: RecurringEntryGateway, useValue: { getAll: () => of(ENTRIES) } },
        { provide: AccountTransactionGateway, useValue: { getAll: () => of(txs) } },
      ],
    });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { confirmedBalanceValue: () => number };
    expect(cmp.confirmedBalanceValue()).toBe(1600);
  });

  it('crée un mouvement via la gateway puis recharge', async () => {
    const accounts = [
      { id: 'a', name: 'Courant', type: 'courant', initialBalance: 0, color: null, dotColor: null },
    ];
    const create = vi.fn(() =>
      of({
        id: 't9',
        accountId: 'a',
        amount: 12,
        direction: 'expense',
        toAccountId: null,
        date: '2026-06-10',
        category: 'food',
        note: null,
        memberId: null,
        recurringEntryId: null,
      }),
    );
    const getAll = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
        { provide: RecurringEntryGateway, useValue: { getAll: () => of(ENTRIES) } },
        {
          provide: AccountTransactionGateway,
          useValue: { getAll, getForAccount: () => of([]), create, delete: () => of(void 0) },
        },
      ],
    });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      draftAmount: { set: (n: number) => void };
      draftDirection: { set: (d: string) => void };
      draftDate: { set: (d: string) => void };
      draftCategory: { set: (c: string) => void };
      addTransaction: () => void;
    };
    cmp.draftAmount.set(12);
    cmp.draftDirection.set('expense');
    cmp.draftDate.set('2026-06-10');
    cmp.draftCategory.set('food');
    cmp.addTransaction();
    expect(create).toHaveBeenCalledWith(
      'a',
      expect.objectContaining({
        amount: 12,
        direction: 'expense',
        date: '2026-06-10',
        category: 'food',
      }),
    );
    // rxResource.reload() recharge de façon asynchrone → attendre la stabilisation.
    await fixture.whenStable();
    expect(getAll).toHaveBeenCalledTimes(2);
  });

  describe('suppression avec annulation', () => {
    const ACCOUNT = {
      id: 'a',
      name: 'Courant',
      type: 'courant',
      initialBalance: 0,
      color: null,
      dotColor: null,
    };
    const TX = {
      id: 't1',
      accountId: 'a',
      amount: 42.5,
      direction: 'expense',
      toAccountId: null,
      date: '2026-06-10',
      category: 'food',
      note: 'Marché',
      memberId: 'm1',
      recurringEntryId: null,
    };

    function mount(gateway: {
      delete: ReturnType<typeof vi.fn>;
      create?: ReturnType<typeof vi.fn>;
      txs?: readonly object[];
      entries?: readonly object[];
      updateEntry?: ReturnType<typeof vi.fn>;
    }) {
      const toaster = { success: vi.fn(), error: vi.fn() };
      const create = gateway.create ?? vi.fn(() => of(TX));
      const updateEntry = gateway.updateEntry ?? vi.fn(() => of({}));
      TestBed.configureTestingModule({
        imports: [
          TranslocoTestingModule.forRoot({
            langs: {},
            translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
          }),
        ],
        providers: [
          provideHttpClient(),
          provideRouter([]),
          { provide: Toaster, useValue: toaster },
          { provide: BankAccountGateway, useValue: { getAll: () => of([ACCOUNT]) } },
          {
            provide: RecurringEntryGateway,
            useValue: { getAll: () => of(gateway.entries ?? ENTRIES), update: updateEntry },
          },
          {
            provide: AccountTransactionGateway,
            useValue: { getAll: () => of(gateway.txs ?? [TX]), delete: gateway.delete, create },
          },
        ],
      });
      const fixture = TestBed.createComponent(Transactions);
      fixture.detectChanges();
      const cmp = fixture.componentInstance as unknown as {
        removeTransaction: (id: string) => void;
      };
      return { fixture, cmp, toaster, create, updateEntry };
    }

    it('supprimer → toast de 6 s avec « Annuler », qui recrée l’opération à l’identique (sans son ancien id)', async () => {
      const { fixture, cmp, toaster, create } = mount({ delete: vi.fn(() => of(void 0)) });
      await fixture.whenStable();

      cmp.removeTransaction('t1');

      expect(toaster.success).toHaveBeenCalledWith(
        'budget.transactions.feedback.deleted',
        undefined,
        expect.objectContaining({ duration: 6000 }),
      );
      const { action } = toaster.success.mock.calls[0][2] as {
        action: { labelKey: string; run: () => void };
      };
      expect(action.labelKey).toBe('shared.toast.undo');
      expect(create).not.toHaveBeenCalled();

      action.run();

      const { id: _id, accountId: _accountId, ...data } = TX;
      expect(create).toHaveBeenCalledWith('a', data);
      expect(toaster.success).toHaveBeenLastCalledWith('budget.transactions.feedback.restored');
    });

    it('suppression refusée par le serveur → toast d’erreur, aucune annulation proposée', async () => {
      const { fixture, cmp, toaster } = mount({
        delete: vi.fn(() => throwError(() => new Error('boom'))),
      });
      await fixture.whenStable();

      cmp.removeTransaction('t1');

      expect(toaster.error).toHaveBeenCalledWith('budget.transactions.feedback.deleteFailed');
      expect(toaster.success).not.toHaveBeenCalled();
    });

    describe('opération créée par le pointage automatique', () => {
      const RENT = {
        id: 'rent',
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
        autoPostSince: '2026-01',
        variableAmount: false,
        skippedMonths: [],
      };
      const MAY = { ...TX, id: 'may', recurringEntryId: 'rent', date: '2026-05-05' };
      const JUNE = { ...TX, id: 'june', recurringEntryId: 'rent', date: '2026-06-05' };
      const { id: _rentId, ...rentData } = RENT;

      it('la supprimer → la récurrence retient le mois, pour que le pointage ne la recrée pas', async () => {
        const { fixture, cmp, updateEntry } = mount({
          delete: vi.fn(() => of(void 0)),
          txs: [MAY],
          entries: [RENT],
        });
        await fixture.whenStable();

        cmp.removeTransaction('may');

        expect(updateEntry).toHaveBeenCalledWith('rent', {
          ...rentData,
          skippedMonths: ['2026-05'],
        });
      });

      it('en supprimer deux à la suite → le second mois s’ajoute au premier, sans l’écraser', async () => {
        const { fixture, cmp, updateEntry } = mount({
          delete: vi.fn(() => of(void 0)),
          txs: [MAY, JUNE],
          entries: [RENT],
        });
        await fixture.whenStable();

        cmp.removeTransaction('may');
        cmp.removeTransaction('june');

        expect(updateEntry).toHaveBeenLastCalledWith('rent', {
          ...rentData,
          skippedMonths: ['2026-05', '2026-06'],
        });
      });

      it('n’envoie la suppression qu’une fois le mois enregistré (sinon le pointage pourrait la recréer entre-temps)', async () => {
        const saved = new Subject<object>();
        const del = vi.fn(() => of(void 0));
        const { fixture, cmp } = mount({
          delete: del,
          txs: [MAY],
          entries: [RENT],
          updateEntry: vi.fn(() => saved),
        });
        await fixture.whenStable();

        cmp.removeTransaction('may');
        expect(del).not.toHaveBeenCalled();
        saved.next({});
        saved.complete();

        expect(del).toHaveBeenCalledWith('may');
      });

      it('mois non enregistré → l’opération n’est pas supprimée, toast d’échec', async () => {
        const del = vi.fn(() => of(void 0));
        const { fixture, cmp, toaster } = mount({
          delete: del,
          txs: [MAY],
          entries: [RENT],
          updateEntry: vi.fn(() => throwError(() => new Error('boom'))),
        });
        await fixture.whenStable();

        cmp.removeTransaction('may');

        expect(del).not.toHaveBeenCalled();
        expect(toaster.error).toHaveBeenCalledWith('budget.transactions.feedback.deleteFailed');
      });

      it('annuler la suppression → la récurrence oublie le mois, le pointage la gère à nouveau', async () => {
        const { fixture, cmp, toaster, updateEntry } = mount({
          delete: vi.fn(() => of(void 0)),
          txs: [MAY],
          entries: [RENT],
        });
        await fixture.whenStable();

        cmp.removeTransaction('may');
        (toaster.success.mock.calls[0][2] as { action: { run: () => void } }).action.run();

        expect(updateEntry).toHaveBeenLastCalledWith('rent', { ...rentData, skippedMonths: [] });
      });
    });

    it('supprimer une opération saisie à la main → aucune récurrence modifiée', async () => {
      const { fixture, cmp, updateEntry } = mount({ delete: vi.fn(() => of(void 0)) });
      await fixture.whenStable();

      cmp.removeTransaction('t1');

      expect(updateEntry).not.toHaveBeenCalled();
    });

    it('annulation qui échoue → toast restoreFailed', async () => {
      const { fixture, cmp, toaster } = mount({
        delete: vi.fn(() => of(void 0)),
        create: vi.fn(() => throwError(() => new Error('boom'))),
      });
      await fixture.whenStable();

      cmp.removeTransaction('t1');
      (toaster.success.mock.calls[0][2] as { action: { run: () => void } }).action.run();

      expect(toaster.error).toHaveBeenCalledWith('budget.transactions.feedback.restoreFailed');
    });
  });
});

describe('Transactions : nom des opérations', () => {
  const ACC = {
    id: 'a',
    name: 'Courant',
    type: 'courant',
    initialBalance: 0,
    color: null,
    dotColor: null,
  };
  const tx = (id: string, over: Record<string, unknown>) => ({
    id,
    accountId: 'a',
    amount: 10,
    direction: 'expense',
    toAccountId: null,
    date: '2026-09-01',
    category: null,
    note: null,
    memberId: null,
    recurringEntryId: null,
    ...over,
  });

  function titles(txs: unknown[]) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: BankAccountGateway, useValue: { getAll: () => of([ACC]) } },
        { provide: RecurringEntryGateway, useValue: { getAll: () => of(ENTRIES) } },
        { provide: AccountTransactionGateway, useValue: { getAll: () => of(txs) } },
      ],
    });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as {
      transactions: () => { id: string; title: string; auto: boolean }[];
    };
    return Object.fromEntries(cmp.transactions().map((t) => [t.id, t]));
  }

  it('une opération pointée automatiquement porte le nom de son prélèvement, pas « auto »', () => {
    const byId = titles([tx('t1', { recurringEntryId: 'rent', note: 'auto' })]);
    expect(byId['t1']).toMatchObject({ title: 'Loyer', auto: true });
  });

  it('une confirmation manuelle aussi, au lieu de retomber sur la catégorie', () => {
    const byId = titles([tx('t1', { recurringEntryId: 'rent' })]);
    expect(byId['t1']).toMatchObject({ title: 'Loyer', auto: false });
  });

  it('sinon : la note saisie, et la catégorie en dernier recours', () => {
    const byId = titles([
      tx('noted', { note: 'Ajustement : écart avec la banque' }),
      tx('bare', {}),
      tx('orphan', { recurringEntryId: 'supprimee', note: 'auto' }),
    ]);
    expect(byId['noted'].title).toBe('Ajustement : écart avec la banque');
    expect(byId['bare'].title).not.toBe('');
    // Récurrence supprimée depuis : on n'affiche pas le mot technique « auto » comme un libellé.
    expect(byId['orphan'].title).toBe(byId['bare'].title);
    expect(byId['orphan'].auto).toBe(true);
  });
});
