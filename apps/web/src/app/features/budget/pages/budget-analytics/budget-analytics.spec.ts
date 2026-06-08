import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { SalaryArchiveGateway } from '@features/budget/domain/gateways/salary-archive.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { RecurringEntry } from '@features/budget/domain/models/recurring-entry.model';
import { BudgetAnalytics } from './budget-analytics';

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
  ...p,
});

function make(entries: RecurringEntry[]) {
  TestBed.configureTestingModule({
    providers: [
      { provide: SalaryArchiveGateway, useValue: { getAll: () => of([]) } },
      { provide: RecurringEntryGateway, useValue: { getAll: () => of(entries) } },
      { provide: EnvelopeGateway, useValue: { getAll: () => of([]) } },
      { provide: LoanGateway, useValue: { getAll: () => of([]) } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(BudgetAnalytics, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(BudgetAnalytics);
  fixture.detectChanges();
  return fixture.componentInstance as unknown as { kpis: () => { label: string; value: number }[] };
}

describe('BudgetAnalytics — calibration', () => {
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
});
