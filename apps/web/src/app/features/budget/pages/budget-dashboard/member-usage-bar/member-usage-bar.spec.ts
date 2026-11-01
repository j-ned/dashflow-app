import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { MemberSummary } from '../../../domain/member-summary';
import { MemberUsageBar } from './member-usage-bar';

const summary = (p: Partial<MemberSummary>): MemberSummary => ({
  id: 'm1',
  label: 'Alice',
  initials: 'A',
  envelopes: [],
  totalEnvelopes: 0,
  lentLoans: [],
  totalLent: 0,
  borrowedLoans: [],
  totalBorrowed: 0,
  incomes: [{} as never],
  totalIncome: 1000,
  monthlyExpenses: [],
  totalMonthlyExpenses: 400,
  annualExpenses: [],
  totalAnnualExpenses: 0,
  monthlyAnnualExpenses: 0,
  spendings: [],
  totalSpendings: 0,
  remaining: 600,
  isExpensePassed: () => false,
  ...p,
});

function mount(s: MemberSummary) {
  TestBed.configureTestingModule({
    imports: [
      MemberUsageBar,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(MemberUsageBar);
  fixture.componentRef.setInput('summary', s);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MemberUsageBar', () => {
  it('état OK (≤ 80%) : badge stateOk et pourcentage', () => {
    const el = mount(summary({ totalIncome: 1000, totalMonthlyExpenses: 400 }));
    expect(el.textContent).toContain('budget.dashboard.usage.stateOk');
    expect(el.textContent).toContain('40%');
  });

  it('état Over (> 100%) : badge stateOver', () => {
    const el = mount(summary({ totalIncome: 1000, totalMonthlyExpenses: 1200 }));
    expect(el.textContent).toContain('budget.dashboard.usage.stateOver');
  });
});
