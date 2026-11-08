import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { BankAddMenu, type AddRequest } from './bank-add-menu';

function mount() {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { fr: {} },
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(BankAddMenu);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;
  const toggle = () => host.querySelector<HTMLButtonElement>('[data-testid="add-toggle"]')!;
  const option = (id: string) => host.querySelector<HTMLButtonElement>(`[data-testid="add-${id}"]`);
  const requests: AddRequest[] = [];
  fixture.componentInstance.add.subscribe((r) => requests.push(r));
  const open = () => {
    toggle().click();
    fixture.detectChanges();
  };
  return { fixture, host, toggle, option, requests, open };
}

describe('BankAddMenu', () => {
  it('fermé par défaut : un seul bouton, aucun choix affiché', () => {
    const { toggle, option } = mount();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(option('income')).toBeNull();
  });

  it('ouvert : propose les cinq types d’opération', () => {
    const { toggle, option, open } = mount();

    open();

    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(
      ['income', 'expense', 'annual_expense', 'spending', 'transfer'].map(
        (id) => option(id) !== null,
      ),
    ).toEqual([true, true, true, true, true]);
  });

  it.each<[string, AddRequest]>([
    ['income', { type: 'income', transferMode: 'recurring' }],
    ['expense', { type: 'expense', transferMode: 'recurring' }],
    ['annual_expense', { type: 'annual_expense', transferMode: 'recurring' }],
    ['spending', { type: 'spending', transferMode: 'recurring' }],
    ['transfer', { type: 'transfer', transferMode: 'one_time' }],
  ])('choisir « %s » demande la bonne création puis referme le menu', (id, expected) => {
    const { fixture, option, toggle, requests, open } = mount();
    open();

    option(id)!.click();
    fixture.detectChanges();

    expect(requests).toEqual([expected]);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('Échap referme le menu sans rien créer', () => {
    const { fixture, host, toggle, requests, open } = mount();
    open();

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(requests).toEqual([]);
  });
});
