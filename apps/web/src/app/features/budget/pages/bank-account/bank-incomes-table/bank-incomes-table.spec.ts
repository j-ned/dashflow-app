import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BankIncomesTable } from './bank-incomes-table';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';

const AUTO_ENTRY = {
  id: 'i1', accountId: 'a', label: 'Salaire', amount: 2000, type: 'income', dayOfMonth: 1,
  date: null, endDate: null, toAccountId: null, category: null, memberId: null, payslipKey: null,
  autoPost: true, autoPostSince: '2026-01',
} as RecurringEntry;

const NORMAL_ENTRY = {
  id: 'i2', accountId: 'a', label: 'Prime', amount: 500, type: 'income', dayOfMonth: 15,
  date: null, endDate: null, toAccountId: null, category: null, memberId: null, payslipKey: null,
  autoPost: false, autoPostSince: null,
} as RecurringEntry;

describe('BankIncomesTable', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { fr: {} }, translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' } })],
    });
  });

  it('affiche le badge auto pour une récurrence auto-pointée et pas pour les autres', () => {
    const fixture = TestBed.createComponent(BankIncomesTable);
    fixture.componentRef.setInput('incomes', [AUTO_ENTRY, NORMAL_ENTRY]);
    fixture.componentRef.setInput('memberMap', new Map());
    fixture.detectChanges();
    const badges = fixture.nativeElement.querySelectorAll('[data-testid="auto-badge"]');
    expect(badges.length).toBe(1);
  });
});
