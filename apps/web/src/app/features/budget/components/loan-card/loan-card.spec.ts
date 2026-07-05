import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { Loan } from '../../domain/models/loan.model';
import { LoanStatus, LoanVM } from '../../domain/loan-vm';
import { LoanCard } from './loan-card';

const LOAN: Loan = {
  id: 'l1',
  memberId: null,
  person: 'Alice',
  direction: 'lent',
  amount: 100,
  remaining: 0,
  description: '',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
};

function vmOf(status: LoanStatus, loan: Partial<Loan> = {}): LoanVM {
  return { loan: { ...LOAN, ...loan }, repaid: 100, pct: 100, entries: [], status };
}

function mount(vm: LoanVM) {
  TestBed.configureTestingModule({
    imports: [
      LoanCard,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(LoanCard);
  fixture.componentRef.setInput('vm', vm);
  fixture.componentRef.setInput('member', null);
  fixture.detectChanges();
  return fixture;
}

describe('LoanCard', () => {
  it('affiche le ruban quand le prêt est soldé', () => {
    const el = mount(vmOf('settled')).nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="achievement-ribbon"]')).not.toBeNull();
  });

  it('pas de ruban quand le prêt est en cours', () => {
    const el = mount(vmOf('ongoing', { remaining: 50 })).nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="achievement-ribbon"]')).toBeNull();
  });

  it('rend le badge « en retard » pour un prêt overdue', () => {
    const el = mount(vmOf('overdue', { remaining: 50, dueDate: '2020-01-01' }))
      .nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="achievement-ribbon"]')).toBeNull();
    expect(el.textContent).toContain('budget.loan.status.overdue');
  });
});
