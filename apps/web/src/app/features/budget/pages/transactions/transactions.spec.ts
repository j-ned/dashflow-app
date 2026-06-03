import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideHttpClient } from '@angular/common/http';
import { Transactions } from './transactions';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';

describe('Transactions page', () => {
  it('expose le solde confirmé du compte sélectionné', () => {
    const accounts = [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 100, color: null, dotColor: null }];
    const txs = [
      { id: 't1', accountId: 'a', amount: 2000, direction: 'income', toAccountId: null, date: '2000-01-01', category: null, note: null, memberId: null, recurringEntryId: null },
      { id: 't2', accountId: 'a', amount: 500, direction: 'expense', toAccountId: null, date: '2000-01-02', category: null, note: null, memberId: null, recurringEntryId: null },
    ];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
        { provide: AccountTransactionGateway, useValue: { getAll: () => of(txs) } },
      ],
    });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { confirmedBalanceValue: () => number };
    expect(cmp.confirmedBalanceValue()).toBe(1600);
  });

  it('crée un mouvement via la gateway puis recharge', () => {
    const accounts = [{ id: 'a', name: 'Courant', type: 'courant', initialBalance: 0, color: null, dotColor: null }];
    const create = vi.fn(() => of({ id: 't9', accountId: 'a', amount: 12, direction: 'expense', toAccountId: null, date: '2026-06-10', category: 'food', note: null, memberId: null, recurringEntryId: null }));
    const getAll = vi.fn(() => of([]));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        { provide: BankAccountGateway, useValue: { getAll: () => of(accounts) } },
        { provide: AccountTransactionGateway, useValue: { getAll, getForAccount: () => of([]), create, delete: () => of(void 0) } },
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
    cmp.draftAmount.set(12); cmp.draftDirection.set('expense');
    cmp.draftDate.set('2026-06-10'); cmp.draftCategory.set('food');
    cmp.addTransaction();
    expect(create).toHaveBeenCalledWith('a', expect.objectContaining({ amount: 12, direction: 'expense', date: '2026-06-10', category: 'food' }));
    expect(getAll).toHaveBeenCalledTimes(2);
  });
});
