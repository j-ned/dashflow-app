import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BankExpenseColumns } from './bank-expense-columns';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

const EXPENSE: RecurringEntry = {
  id: 'e1', accountId: 'a', toAccountId: null, label: 'Netflix', amount: 16,
  type: 'expense', dayOfMonth: 10, date: null, endDate: null, category: null,
  payslipKey: null, memberId: null, autoPost: false, autoPostSince: null,
};
const SAVING: RecurringEntry = {
  id: 't1', accountId: 'a', toAccountId: 'liv', label: 'Épargne', amount: 200,
  type: 'transfer', dayOfMonth: 5, date: null, endDate: null, category: null,
  payslipKey: null, memberId: null, autoPost: false, autoPostSince: null,
};

function mount(rows: RecurringEntry[], savingsSubtotal: number) {
  TestBed.configureTestingModule({
    imports: [
      BankExpenseColumns,
      TranslocoTestingModule.forRoot({
        langs: {}, translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(BankExpenseColumns);
  const ref = fixture.componentRef;
  ref.setInput('monthlyExpenses', rows);
  ref.setInput('annualExpenses', []);
  ref.setInput('monthSpendings', []);
  ref.setInput('totalMonthlyExpenses', 16);
  ref.setInput('totalAnnualExpenses', 0);
  ref.setInput('monthlyAnnualExpenses', 0);
  ref.setInput('totalMonthSpendings', 0);
  ref.setInput('savingsSubtotal', savingsSubtotal);
  ref.setInput('spendingMonthLabel', 'juin 2026');
  ref.setInput('memberMap', new Map());
  ref.setInput('isExpensePassed', () => false);
  ref.setInput('accountNameById', (id: string | null) => (id === 'liv' ? 'Livret A' : null));
  fixture.detectChanges();
  return fixture;
}

describe('BankExpenseColumns — versement épargne', () => {
  it('affiche un badge destination sur une ligne de virement', () => {
    const fixture = mount([EXPENSE, SAVING], 200);
    const badge = fixture.nativeElement.querySelector('[data-testid="savings-badge"]');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Livret A');
  });

  it('affiche la ligne sous-total « dont épargne » quand > 0', () => {
    const fixture = mount([EXPENSE, SAVING], 200);
    const sub = fixture.nativeElement.querySelector('[data-testid="savings-subtotal"]');
    expect(sub).not.toBeNull();
    expect(sub.textContent).toContain('200');
  });

  it('masque le sous-total quand aucune épargne', () => {
    const fixture = mount([EXPENSE], 0);
    expect(fixture.nativeElement.querySelector('[data-testid="savings-subtotal"]')).toBeNull();
  });
});
