import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { BalanceCheck } from './balance-check';

describe('BalanceCheck', () => {
  function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {},
          translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(BalanceCheck);
    for (const [k, v] of Object.entries({ confirmedBalance: 1441.41, ...inputs }))
      fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends HTMLElement>(id: string) => el.querySelector<T>(`[data-testid="${id}"]`);
    const emitted: number[] = [];
    fixture.componentInstance.checked.subscribe((v) => emitted.push(v));
    const type = async (value: string) => {
      const input = q<HTMLInputElement>('balance-check-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
    };
    const openForm = async () => {
      q('balance-check-open')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, q, emitted, type, openForm };
  }

  it('replié par défaut : un bouton, et le rappel « jamais comparé »', () => {
    const { q } = render();
    expect(q('balance-check-form')).toBeNull();
    expect(q('balance-check-last')?.textContent).toContain('budget.bankAccount.check.neverChecked');
  });

  it('rappelle la date de la dernière vérification', () => {
    const { q } = render({ checkedAt: Date.UTC(2026, 7, 20, 12) });
    expect(q('balance-check-last')?.textContent).toContain('budget.bankAccount.check.lastChecked');
  });

  it('sans montant saisi : on ne peut rien valider', async () => {
    const { q, openForm } = render();
    await openForm();
    expect(q<HTMLButtonElement>('balance-check-submit')!.disabled).toBe(true);
  });

  it('écart négatif : montre l’écart, propose de le rattraper, émet le solde réel saisi', async () => {
    const { q, type, openForm, emitted, fixture } = render();
    await openForm();
    await type('1438.31');
    expect(q('balance-check-gap')?.textContent).toMatch(/3[.,]10/);
    expect(q('balance-check-gap')?.textContent).toContain('budget.bankAccount.check.gapLess');
    expect(q('balance-check-submit')?.textContent).toContain('budget.bankAccount.check.adjust');

    q('balance-check-submit')!.click();
    fixture.detectChanges();
    expect(emitted).toEqual([1438.31]);
    expect(q('balance-check-form')).toBeNull();
  });

  it('soldes identiques : « tout est juste », et valider compte quand même comme une vérification', async () => {
    const { q, type, openForm, emitted } = render();
    await openForm();
    await type('1441.41');
    expect(q('balance-check-gap')?.textContent).toContain('budget.bankAccount.check.match');
    expect(q('balance-check-submit')?.textContent).toContain(
      'budget.bankAccount.check.confirmMatch',
    );
    q('balance-check-submit')!.click();
    expect(emitted).toEqual([1441.41]);
  });
});
