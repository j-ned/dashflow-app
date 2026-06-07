import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { Loan } from '../../domain/models/loan.model';
import { LoanTransaction } from '../../domain/models/loan-transaction.model';
import { HistoryEntry } from '../../domain/loan-vm';
import { LoanHistoryDetail } from './loan-history-detail';

const LOAN: Loan = {
  id: 'l1',
  memberId: null,
  person: 'Alice',
  direction: 'lent',
  amount: 1000,
  remaining: 600,
  description: '',
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
};

function tx(over: Partial<LoanTransaction> = {}): LoanTransaction {
  return { id: 't1', loanId: 'l1', amount: 100, date: '2026-06-01', note: null, ...over };
}

function mount(loan: Loan | null, history: HistoryEntry[]) {
  TestBed.configureTestingModule({
    imports: [
      LoanHistoryDetail,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(LoanHistoryDetail);
  fixture.componentRef.setInput('loan', loan);
  fixture.componentRef.setInput('history', history);
  fixture.detectChanges();
  return fixture;
}

describe('LoanHistoryDetail', () => {
  it('rend la carte récap quand un prêt est fourni (montant initial affiché)', () => {
    const fixture = mount(LOAN, []);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('1,000.00');
  });

  it('rend une ligne par paiement quand l’historique est non vide', () => {
    const fixture = mount(LOAN, [
      { tx: tx({ id: 'a' }), balanceAfter: 600 },
      { tx: tx({ id: 'b', date: '2026-05-01' }), balanceAfter: 700 },
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('li').length).toBe(2);
  });

  it('rend l’état vide quand l’historique est vide', () => {
    const fixture = mount(LOAN, []);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('li').length).toBe(0);
    expect(el.textContent).toContain('budget.loan.modal.noPayments');
  });
});
