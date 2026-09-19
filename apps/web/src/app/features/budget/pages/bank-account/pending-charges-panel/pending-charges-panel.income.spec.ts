import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PendingChargesPanel } from './pending-charges-panel';
import { PendingCharge } from '../../../domain/pending-charge';

function charge(
  id: string,
  direction: PendingCharge['direction'],
  suggestedAmount: number | null,
): PendingCharge {
  return {
    entry: {
      id,
      accountId: 'a',
      label: id,
      amount: 1921.33,
      type: direction,
    } as PendingCharge['entry'],
    direction,
    suggestedDate: '2026-09-01',
    suggestedAmount,
  };
}

describe('PendingChargesPanel — revenus', () => {
  function render(charges: PendingCharge[]) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(PendingChargesPanel);
    fixture.componentRef.setInput('charges', charges);
    fixture.componentRef.setInput('accountNameById', () => null);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(id: string) => el.querySelector<T>(`[data-testid="${id}"]`);
    return { fixture, el, q };
  }

  it('sépare les revenus des prélèvements, et ne compte que les prélèvements', () => {
    const { q } = render([charge('salaire', 'income', null), charge('loyer', 'expense', 600)]);
    expect(q('pending-incomes')?.querySelector('[data-testid="confirm-salaire"]')).not.toBeNull();
    expect(q('pending-panel')?.querySelector('[data-testid="confirm-loyer"]')).not.toBeNull();
    expect(q('pending-panel')?.querySelector('[data-testid="confirm-salaire"]')).toBeNull();
    expect(q('pending-panel')?.textContent).toContain('1');
  });

  it('parle de « reçu » pour un revenu et de « débité » pour un prélèvement', () => {
    const { q } = render([charge('salaire', 'income', null), charge('loyer', 'expense', 600)]);
    expect(q('confirm-salaire')?.textContent).toContain('budget.bankAccount.pending.received');
    expect(q('ignore-salaire')?.textContent).toContain('budget.bankAccount.pending.notReceived');
    expect(q('confirm-loyer')?.textContent).toContain('budget.bankAccount.pending.confirm');
  });

  it('salaire variable : champ vide, « Reçu » inactif tant qu’aucun montant n’est saisi', async () => {
    const { fixture, q } = render([charge('salaire', 'income', null)]);
    await fixture.whenStable();
    const input = q<HTMLInputElement>('amount-salaire')!;
    const button = q<HTMLButtonElement>('confirm-salaire')!;
    expect(input.value).toBe('');
    expect(button.disabled).toBe(true);

    let emitted: { id: string; amount: number } | undefined;
    fixture.componentInstance.confirm.subscribe((e) => (emitted = e));
    input.value = '2050.4';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    button.click();
    expect(emitted).toEqual({ id: 'salaire', amount: 2050.4 });
  });

  it('sans prélèvement en attente : pas de « Tout confirmer » à côté d’un salaire', () => {
    const { q } = render([charge('salaire', 'income', null)]);
    expect(q('confirm-all')).toBeNull();
  });
});
