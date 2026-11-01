import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { MemberSummary } from '../../../domain/member-summary';
import { MemberSummaryHeader } from './member-summary-header';

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
      MemberSummaryHeader,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(MemberSummaryHeader);
  fixture.componentRef.setInput('summary', s);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MemberSummaryHeader', () => {
  it('affiche initiales et nom', () => {
    const el = mount(summary({}));
    expect(el.textContent).toContain('AM');
    expect(el.textContent).toContain('Alice Martin');
  });

  it('masque la clé revenus si incomes est vide', () => {
    expect(mount(summary({ incomes: [] })).textContent).not.toContain(
      'budget.dashboard.incomesCount',
    );
  });

  it('affiche la clé revenus si incomes > 0', () => {
    expect(mount(summary({ incomes: [{} as never] })).textContent).toContain(
      'budget.dashboard.incomesCount',
    );
  });
});
