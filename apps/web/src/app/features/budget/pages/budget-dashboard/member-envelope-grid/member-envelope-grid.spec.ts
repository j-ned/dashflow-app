import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { Envelope } from '../../../domain/models/envelope.model';
import { MemberSummary } from '../../../domain/member-summary';
import { MemberEnvelopeGrid } from './member-envelope-grid';

const env = (p: Partial<Envelope>): Envelope => ({
  id: 'e',
  memberId: null,
  name: 'Vacances',
  type: 'vacances',
  balance: 300,
  target: null,
  color: '#00ff00',
  dueDay: null,
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
      MemberEnvelopeGrid,
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
    providers: [provideRouter([])],
  });
  const fixture = TestBed.createComponent(MemberEnvelopeGrid);
  fixture.componentRef.setInput('summary', s);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('MemberEnvelopeGrid', () => {
  it('affiche nom et solde de chaque enveloppe', () => {
    const el = mount(summary({ envelopes: [env({ name: 'Vacances', balance: 300 })] }));
    expect(el.textContent).toContain('Vacances');
    expect(el.textContent).toContain('300.00');
    expect(el.textContent).toContain('budget.dashboard.envelopes');
  });

  it('affiche la barre cible quand target est défini', () => {
    const el = mount(summary({ envelopes: [env({ balance: 150, target: 300 })] }));
    expect(el.textContent).toContain('50%');
  });
});
