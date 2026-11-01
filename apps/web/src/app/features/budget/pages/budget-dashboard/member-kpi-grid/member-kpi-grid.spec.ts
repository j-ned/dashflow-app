import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { MemberSummary } from '../../../domain/member-summary';
import { MemberKpiGrid } from './member-kpi-grid';

const summary = (p: Partial<MemberSummary>): MemberSummary => ({
  id: 'm1',
  label: 'Alice Martin',
  initials: 'AM',
  envelopes: [],
  totalEnvelopes: 0,
  lentLoans: [],
  totalLent: 0,
  borrowedLoans: [],
  totalBorrowed: 0,
  incomes: [],
  totalIncome: 0,
  monthlyExpenses: [],
  totalMonthlyExpenses: 0,
  annualExpenses: [],
  totalAnnualExpenses: 0,
  monthlyAnnualExpenses: 0,
  spendings: [],
  totalSpendings: 0,
  remaining: 0,
  isExpensePassed: () => false,
  ...p,
});

function mount(s: MemberSummary) {
  TestBed.configureTestingModule({
    imports: [
      MemberKpiGrid,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(MemberKpiGrid);
  fixture.componentRef.setInput('summary', s);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MemberKpiGrid', () => {
  it('affiche la carte revenu avec le total quand incomes > 0', () => {
    const el = mount(summary({ incomes: [{} as never], totalIncome: 2000 }));
    expect(el.textContent).toContain('budget.dashboard.kpi.income');
    expect(el.textContent).toContain('2,000.00');
  });

  it('masque revenu et reste sans revenus, affiche les charges', () => {
    const el = mount(summary({ incomes: [], totalMonthlyExpenses: 300 }));
    expect(el.textContent).not.toContain('budget.dashboard.kpi.income');
    expect(el.textContent).not.toContain('budget.dashboard.kpi.remaining');
    expect(el.textContent).toContain('budget.dashboard.kpi.monthlyCharges');
  });
});
