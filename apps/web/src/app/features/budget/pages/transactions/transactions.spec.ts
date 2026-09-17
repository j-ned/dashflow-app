import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Toaster } from '@shared/components/toast/toast';
import { Transactions } from './transactions';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';

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
    }) {
      const toaster = { success: vi.fn(), error: vi.fn() };
      const create = gateway.create ?? vi.fn(() => of(TX));
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
            provide: AccountTransactionGateway,
            useValue: { getAll: () => of([TX]), delete: gateway.delete, create },
          },
        ],
      });
      const fixture = TestBed.createComponent(Transactions);
      fixture.detectChanges();
      const cmp = fixture.componentInstance as unknown as {
        removeTransaction: (id: string) => void;
      };
      return { fixture, cmp, toaster, create };
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
