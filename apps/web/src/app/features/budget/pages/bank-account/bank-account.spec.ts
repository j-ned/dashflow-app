import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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

type Cmp = { confirmedBalance: () => number; projectedBalance: () => number };

const ACCOUNTS = [
  { id: 'a', name: 'Courant', type: 'courant', initialBalance: 1000, color: null, dotColor: null },
];

function makeComponent(opts: { entries?: unknown[]; txs?: unknown[] } = {}) {
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      { provide: RecurringEntryGateway, useValue: { getAll: () => of(opts.entries ?? []) } },
      { provide: BankAccountGateway, useValue: { getAll: () => of(ACCOUNTS) } },
      { provide: MemberGateway, useValue: { getAll: () => of([]) } },
      { provide: SalaryArchiveGateway, useValue: { getAll: () => of([]) } },
      { provide: AccountTransactionGateway, useValue: { getAll: () => of(opts.txs ?? []) } },
      { provide: Toaster, useValue: { success: () => {}, error: () => {}, info: () => {} } },
      { provide: ConfirmService, useValue: { ask: () => of(true) } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k, getActiveLang: () => 'fr' } },
    ],
  });
  TestBed.overrideComponent(BankAccount, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BankAccount);
  fixture.detectChanges();
  return fixture.componentInstance as unknown as Cmp;
}

describe('BankAccount — solde confirmé', () => {
  it('confirmedBalance = solde initial quand aucune transaction réelle', () => {
    expect(makeComponent().confirmedBalance()).toBe(1000);
  });

  it('confirmedBalance reflète les transactions réelles (initial + revenu − dépense)', () => {
    const txs = [
      { id: 't1', accountId: 'a', amount: 200, direction: 'income', toAccountId: null, date: '2000-01-01', category: null, note: null, memberId: null, recurringEntryId: null },
      { id: 't2', accountId: 'a', amount: 50, direction: 'expense', toAccountId: null, date: '2000-01-02', category: null, note: null, memberId: null, recurringEntryId: null },
    ];
    expect(makeComponent({ txs }).confirmedBalance()).toBe(1150);
  });
});
