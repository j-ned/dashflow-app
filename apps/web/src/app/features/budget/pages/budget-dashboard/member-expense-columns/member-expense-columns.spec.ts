import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';
import { MemberSummary } from '../../../domain/member-summary';
import { MemberExpenseColumns } from './member-expense-columns';

const entry = (p: Partial<RecurringEntry>): RecurringEntry => ({
  id: 'x',
  memberId: null,
  accountId: null,
  toAccountId: null,
  label: '',
  amount: 0,
  type: 'expense',
  dayOfMonth: null,
  date: null,
  endDate: null,
  category: null,
  payslipKey: null,
  autoPost: false,
  autoPostSince: null,
  ...p,
});
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
      MemberExpenseColumns,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(MemberExpenseColumns);
  fixture.componentRef.setInput('summary', s);
  fixture.componentRef.setInput('dashRefCardHeight', null);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MemberExpenseColumns', () => {
  it('rend la colonne mensuel avec le marqueur data-dash-ref', () => {
    const el = mount(
      summary({
        monthlyExpenses: [entry({ id: 'e1', label: 'Loyer', amount: 500, dayOfMonth: 5 })],
        totalMonthlyExpenses: 500,
      }),
    );
    expect(el.querySelector('[data-dash-ref]')).not.toBeNull();
    expect(el.textContent).toContain('Loyer');
    expect(el.textContent).toContain('budget.dashboard.monthly');
  });

  it('barre une charge déjà passée (isExpensePassed)', () => {
    const el = mount(
      summary({
        monthlyExpenses: [entry({ id: 'e1', label: 'Loyer', amount: 500, dayOfMonth: 5 })],
        totalMonthlyExpenses: 500,
        isExpensePassed: () => true,
      }),
    );
    expect(el.querySelector('.line-through')).not.toBeNull();
  });
});
