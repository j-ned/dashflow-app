import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { SalaryArchiveGateway } from '@features/budget/domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { AccountTransaction } from '@features/budget/domain/models/account-transaction.model';
import { RecurringEntry } from '@features/budget/domain/models/recurring-entry.model';
import { todayIso } from '@shared/utils/local-date';
import { BudgetAnalytics } from './budget-analytics';
import { AccountTransactionGateway } from '@features/budget/domain/gateways/account-transaction.gateway';

const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'x',
  memberId: null,
  accountId: null,
  toAccountId: null,
  label: '',
  amount: 0,
  type: 'income',
  dayOfMonth: null,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  variableAmount: false,
  ...p,
});

function make(entries: RecurringEntry[], transactions: AccountTransaction[] = []) {
  TestBed.configureTestingModule({
    providers: [
      { provide: SalaryArchiveGateway, useValue: { getAll: () => of([]) } },
      { provide: RecurringEntryGateway, useValue: { getAll: () => of(entries) } },
      { provide: EnvelopeGateway, useValue: { getAll: () => of([]) } },
      { provide: LoanGateway, useValue: { getAll: () => of([]) } },
      { provide: AccountTransactionGateway, useValue: { getAll: () => of(transactions) } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(BudgetAnalytics, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BudgetAnalytics);
  fixture.detectChanges();
  return fixture.componentInstance as unknown as {
    kpis: () => { label: string; value: number; sub: string | null }[];
  };
}

describe('BudgetAnalytics : calibration', () => {
  it('le KPI revenu exclut une income terminée (endDate passée)', () => {
    const past = new Date(Date.UTC(new Date().getUTCFullYear() - 1, 0, 1))
      .toISOString()
      .slice(0, 10);
    const cmp = make([
      entry({ type: 'income', amount: 2000 }),
      entry({ type: 'income', amount: 999, endDate: past }),
    ]);
    expect(cmp.kpis().some((k) => k.value === 2000)).toBe(true);
    expect(cmp.kpis().some((k) => k.value === 2999)).toBe(false);
  });

  it('les dépenses hors mois courant n’inflent pas les charges', () => {
    const cm = new Date().toISOString().slice(0, 7);
    const cmp = make([
      entry({ type: 'income', amount: 1000 }),
      entry({ type: 'spending', amount: 50, date: cm + '-10' }),
      entry({ type: 'spending', amount: 9999, date: '2000-01-10' }),
    ]);
    const charges = cmp.kpis().find((k) => k.label === 'budget.analytics.kpi.totalCharges');
    expect(charges?.value).toBe(50);
  });

  it('revenu variable : tuile partielle tant qu’il n’est pas saisi, montant reçu ensuite', () => {
    const salary = entry({ id: 'sal', type: 'income', amount: 2000, variableAmount: true });
    const incomeTile = (cmp: ReturnType<typeof make>) =>
      cmp.kpis().find((k) => k.label === 'budget.analytics.kpi.monthlyIncome');

    const pending = incomeTile(make([salary]));
    expect(pending?.value).toBe(0);
    expect(pending?.sub).toBe('budget.analytics.kpi.incomeIncomplete');

    TestBed.resetTestingModule();
    const received = incomeTile(
      make(
        [salary],
        [
          {
            id: 't1',
            accountId: 'a',
            amount: 2150,
            direction: 'income',
            toAccountId: null,
            date: `${todayIso().slice(0, 7)}-02`,
            category: null,
            note: null,
            memberId: null,
            recurringEntryId: 'sal',
          },
        ],
      ),
    );
    expect(received?.value).toBe(2150);
    expect(received?.sub).toBeNull();
  });
});
