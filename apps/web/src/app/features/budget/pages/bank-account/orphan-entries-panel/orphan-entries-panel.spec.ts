import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { OrphanEntriesPanel } from './orphan-entries-panel';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';
import { BankAccount } from '../../../domain/models/bank-account.model';

const ORPHAN = {
  id: 'o1',
  accountId: null,
  label: 'Netflix',
  amount: 15,
  type: 'expense',
  dayOfMonth: 5,
  date: null,
  endDate: null,
  toAccountId: null,
  category: null,
  memberId: null,
  payslipKey: null,
} as RecurringEntry;
const ACCOUNTS = [
  { id: 'a', name: 'Courant', type: 'courant', initialBalance: 0, color: null, dotColor: null },
] as BankAccount[];

describe('OrphanEntriesPanel', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
    });
  });

  it("émet reassign avec l'id et l'accountId choisi", () => {
    const fixture = TestBed.createComponent(OrphanEntriesPanel);
    fixture.componentRef.setInput('entries', [ORPHAN]);
    fixture.componentRef.setInput('accounts', ACCOUNTS);
    fixture.detectChanges();
    let emitted: { id: string; accountId: string } | undefined;
    fixture.componentInstance.reassign.subscribe((e) => (emitted = e));
    const select = fixture.nativeElement.querySelector(
      '[data-testid="orphan-account-o1"]',
    ) as HTMLSelectElement;
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    expect(emitted).toEqual({ id: 'o1', accountId: 'a' });
  });

  it("émet delete avec l'id", () => {
    const fixture = TestBed.createComponent(OrphanEntriesPanel);
    fixture.componentRef.setInput('entries', [ORPHAN]);
    fixture.componentRef.setInput('accounts', ACCOUNTS);
    fixture.detectChanges();
    let deleted: string | undefined;
    fixture.componentInstance.delete.subscribe((id) => (deleted = id));
    (
      fixture.nativeElement.querySelector('[data-testid="delete-orphan-o1"]') as HTMLButtonElement
    ).click();
    expect(deleted).toBe('o1');
  });

  it('ne rend rien quand la liste est vide', () => {
    const fixture = TestBed.createComponent(OrphanEntriesPanel);
    fixture.componentRef.setInput('entries', []);
    fixture.componentRef.setInput('accounts', ACCOUNTS);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="orphan-panel"]')).toBeNull();
  });
});
