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
        { provide: AccountTransactionGateway, useValue: { getForAccount: () => of(txs), getAll: () => of(txs) } },
      ],
    });
    const fixture = TestBed.createComponent(Transactions);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as unknown as { confirmedBalanceValue: () => number };
    expect(cmp.confirmedBalanceValue()).toBe(1600);
  });
});
