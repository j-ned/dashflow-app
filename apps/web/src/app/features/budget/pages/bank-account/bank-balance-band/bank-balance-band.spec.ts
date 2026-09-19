import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BankBalanceBand } from './bank-balance-band';

describe('BankBalanceBand', () => {
  function render(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(BankBalanceBand);
    const all = { confirmedBalance: 0, projectedBalance: 1167.41, today: '19 sept.', ...inputs };
    for (const [key, value] of Object.entries(all)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, q: (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`) };
  }

  it('projection complète : affiche le solde projeté', () => {
    const { q } = render({});
    expect(q('projected-balance')?.textContent).toContain('1');
    expect(q('projection-incomplete')).toBeNull();
  });

  it('salaire non saisi : aucun chiffre projeté, mais les prélèvements à venir restent affichés', () => {
    const { q } = render({ unknownIncomes: ['Salaire'], upcomingDebits: 753.59 });
    expect(q('projected-balance')).toBeNull();
    expect(q('projection-incomplete')).not.toBeNull();
    expect(q('upcoming-debits')?.textContent).toContain('753');
  });

  it('compte sans point de départ : propose de renseigner le solde réel', () => {
    const { fixture, q } = render({ needsStartingBalance: true });
    let asked = false;
    fixture.componentInstance.setStartingBalance.subscribe(() => (asked = true));
    q('starting-balance-hint')?.querySelector('button')?.click();
    expect(asked).toBe(true);
  });

  it('compte déjà alimenté : pas d’invite', () => {
    expect(render({}).q('starting-balance-hint')).toBeNull();
  });
});
