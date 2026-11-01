import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PendingChargesPanel } from './pending-charges-panel';
import { PendingCharge } from '../../../domain/pending-charge';

function charge(id: string, amount: number): PendingCharge {
  return {
    entry: {
      id,
      accountId: 'a',
      label: 'Loyer',
      amount,
      type: 'expense',
      dayOfMonth: 5,
      date: null,
      endDate: null,
      toAccountId: null,
      category: null,
      memberId: null,
      payslipKey: null,
    } as PendingCharge['entry'],
    direction: 'expense',
    suggestedDate: '2026-06-05',
    suggestedAmount: amount,
  };
}

describe('PendingChargesPanel', () => {
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

  it('émet confirm avec le montant suggéré', () => {
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', [charge('r1', 800)]);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    let emitted: { id: string; amount: number } | undefined;
    fixture.componentInstance.confirm.subscribe((e) => (emitted = e));
    (
      fixture.nativeElement.querySelector('[data-testid="confirm-r1"]') as HTMLButtonElement
    ).click();
    expect(emitted).toEqual({ id: 'r1', amount: 800 });
  });

  it("émet ignore avec l'id", () => {
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', [charge('r1', 800)]);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    let ignored: string | undefined;
    fixture.componentInstance.ignore.subscribe((id) => (ignored = id));
    (fixture.nativeElement.querySelector('[data-testid="ignore-r1"]') as HTMLButtonElement).click();
    expect(ignored).toBe('r1');
  });

  it('ne rend rien quand la liste est vide', () => {
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', []);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="pending-panel"]')).toBeNull();
  });
});
