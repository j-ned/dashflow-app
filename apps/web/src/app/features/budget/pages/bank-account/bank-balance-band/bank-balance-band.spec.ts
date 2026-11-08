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
    const all = {
      confirmedBalance: 0,
      projectedBalance: 1167.41,
      today: '19 sept.',
      projectionDate: '29 sept.',
      ...inputs,
    };
    for (const [key, value] of Object.entries(all)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, q: (id: string) => el.querySelector<HTMLElement>(`[data-testid="${id}"]`) };
  }

  it('projection complète : affiche le solde projeté', () => {
    const { q } = render({});
    expect(q('projected-balance')?.textContent).toContain('1');
  });

  it('salaire variable non saisi : le projeté reste chiffré et dit ce qu’il ne compte pas', () => {
    const { q } = render({ unknownIncomes: ['Salaire'], projectedBalance: -71.57 });

    expect(q('projected-balance')?.textContent).toContain('71');
    expect(q('projection-excludes')?.textContent).toContain(
      'budget.bankAccount.balance.excludesHint',
    );
  });

  it('revenus tous connus : aucune mention d’exclusion', () => {
    expect(render({}).q('projection-excludes')).toBeNull();
  });

  it('compte sans point de départ : explique que 0,00 € n’est pas le vrai solde', () => {
    expect(render({ needsStartingBalance: true }).q('starting-balance-hint')).not.toBeNull();
  });

  it('compte déjà alimenté : pas d’invite', () => {
    expect(render({}).q('starting-balance-hint')).toBeNull();
  });
});
