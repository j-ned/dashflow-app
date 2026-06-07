import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BudgetDataStore } from './budget-data.store';

const ACCS = [
  { id: 'a', name: 'Courant', type: 'courant', initialBalance: 0, color: null, dotColor: null },
  { id: 'b', name: 'Livret', type: 'épargne', initialBalance: 0, color: null, dotColor: null },
];
const ENTRY = {
  id: 'e',
  accountId: 'a',
  toAccountId: null,
  label: 'l',
  amount: 1,
  type: 'expense',
  dayOfMonth: 5,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  memberId: null,
  autoPost: false,
  autoPostSince: null,
};

function makeStore(entryGetAll = vi.fn(() => of([ENTRY])), txGetAll = vi.fn(() => of([]))) {
  TestBed.configureTestingModule({
    providers: [
      BudgetDataStore,
      { provide: RecurringEntryGateway, useValue: { getAll: entryGetAll } },
      { provide: BankAccountGateway, useValue: { getAll: () => of(ACCS) } },
      {
        provide: MemberGateway,
        useValue: { getAll: () => of([{ id: 'm', firstName: 'A', lastName: 'B', color: null }]) },
      },
      { provide: AccountTransactionGateway, useValue: { getAll: txGetAll } },
    ],
  });
  const store = TestBed.inject(BudgetDataStore);
  TestBed.tick();
  return { store, entryGetAll, txGetAll };
}

describe('BudgetDataStore', () => {
  it('expose les données chargées', () => {
    const { store } = makeStore();
    expect(store.entries().map((e) => e.id)).toEqual(['e']);
    expect(store.accounts().map((a) => a.id)).toEqual(['a', 'b']);
    expect(store.members()).toHaveLength(1);
    expect(store.entriesLoaded()).toBe(true);
    expect(store.transactionsLoaded()).toBe(true);
  });

  it('selectedAccountId vaut le 1er compte par défaut', () => {
    const { store } = makeStore();
    expect(store.selectedAccountId()).toBe('a');
  });

  it('selectAccount fixe la sélection', () => {
    const { store } = makeStore();
    store.selectAccount('b');
    expect(store.selectedAccountId()).toBe('b');
    store.selectAccount(null);
    expect(store.selectedAccountId()).toBeNull();
  });

  it('refreshEntries re-déclenche le chargement des entrées', () => {
    const entryGetAll = vi.fn(() => of([ENTRY]));
    const { store } = makeStore(entryGetAll);
    expect(entryGetAll).toHaveBeenCalledTimes(1);
    store.refreshEntries();
    TestBed.tick();
    expect(entryGetAll).toHaveBeenCalledTimes(2);
  });

  it('refreshTransactions re-déclenche le chargement des transactions', () => {
    const txGetAll = vi.fn(() => of([]));
    const { store } = makeStore(
      vi.fn(() => of([ENTRY])),
      txGetAll,
    );
    expect(txGetAll).toHaveBeenCalledTimes(1);
    store.refreshTransactions();
    TestBed.tick();
    expect(txGetAll).toHaveBeenCalledTimes(2);
  });
});
