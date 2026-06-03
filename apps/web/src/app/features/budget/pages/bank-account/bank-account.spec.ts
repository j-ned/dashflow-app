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
      { provide: TranslocoService, useValue: { translate: (k: string) => k, getActiveLang: () => 'fr', events$: of({ type: 'translationLoadSuccess' }) } },
    ],
  });
  TestBed.overrideComponent(BankAccount, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BankAccount);
  fixture.detectChanges();
  return fixture.componentInstance as unknown as Cmp;
}

describe('BankAccount — solde projeté', () => {
  const RENT = { id: 'r1', accountId: 'a', label: 'Loyer', amount: 800, type: 'expense' as const, dayOfMonth: 5, date: null, endDate: null, toAccountId: null, category: null, memberId: null, payslipKey: null };

  it('projeté = confirmé + delta des récurrences (zéro transaction réelle)', () => {
    const cmp = makeComponent({ entries: [RENT] });
    expect(cmp.confirmedBalance()).toBe(1000);
    expect(cmp.projectedBalance()).toBe(200); // 1000 − 800
  });

  it('une récurrence postée (transaction réelle de même recurringEntryId ce mois) est exclue du delta', () => {
    const month = new Date().toISOString().slice(0, 7);
    // Daté au 1er du mois : toujours ≤ aujourd'hui (compté dans confirmedBalance) ET même mois (détecté posté).
    const posted = { id: 'tx', accountId: 'a', amount: 800, direction: 'expense', toAccountId: null, date: `${month}-01`, category: null, note: null, memberId: null, recurringEntryId: 'r1' };
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
      { id: 't1', accountId: 'a', amount: 200, direction: 'income', toAccountId: null, date: '2000-01-01', category: null, note: null, memberId: null, recurringEntryId: null },
      { id: 't2', accountId: 'a', amount: 50, direction: 'expense', toAccountId: null, date: '2000-01-02', category: null, note: null, memberId: null, recurringEntryId: null },
    ];
    expect(makeComponent({ txs }).confirmedBalance()).toBe(1150);
  });
});

describe('BankAccount — échéances à confirmer', () => {
  const month = new Date().toISOString().slice(0, 7);
  const RENT = { id: 'r1', accountId: 'a', label: 'Loyer', amount: 800, type: 'expense', dayOfMonth: 1, date: null, endDate: null, toAccountId: null, category: null, memberId: null, payslipKey: null };

  it('pendingCharges inclut une dépense récurrente échue et non postée', () => {
    const cmp = makeComponent({ entries: [RENT] }) as unknown as { pendingCharges: () => unknown[] };
    expect(cmp.pendingCharges().length).toBe(1);
  });

  it('pendingCharges exclut une récurrence déjà postée ce mois', () => {
    const posted = { id: 'tx', accountId: 'a', amount: 800, direction: 'expense', toAccountId: null, date: `${month}-01`, category: null, note: null, memberId: null, recurringEntryId: 'r1' };
    const cmp = makeComponent({ entries: [RENT], txs: [posted] }) as unknown as { pendingCharges: () => unknown[] };
    expect(cmp.pendingCharges().length).toBe(0);
  });

  it('ignoreCharge retire l\'échéance de la liste', () => {
    const cmp = makeComponent({ entries: [RENT] }) as unknown as { pendingCharges: () => unknown[]; ignoreCharge: (id: string) => void };
    expect(cmp.pendingCharges().length).toBe(1);
    cmp.ignoreCharge('r1');
    expect(cmp.pendingCharges().length).toBe(0);
  });
});
