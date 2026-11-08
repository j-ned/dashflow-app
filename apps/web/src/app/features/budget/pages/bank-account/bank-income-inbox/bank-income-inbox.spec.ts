import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { describe, expect, it } from 'vitest';
import { BankIncomeInbox } from './bank-income-inbox';
import { PendingCharge } from '../../../domain/pending-charge';

function income(id: string, suggestedAmount: number | null): PendingCharge {
  return {
    entry: {
      id,
      accountId: 'a',
      label: id,
      amount: 1921.33,
      type: 'income',
    } as PendingCharge['entry'],
    direction: 'income',
    suggestedDate: '2026-10-30',
    suggestedAmount,
  };
}

function render(charges: PendingCharge[]) {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: {},
        translocoConfig: { availableLangs: ['fr'], defaultLang: 'fr' },
      }),
    ],
  });
  const fixture = TestBed.createComponent(BankIncomeInbox);
  fixture.componentRef.setInput('charges', charges);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement>(id: string) => el.querySelector<T>(`[data-testid="${id}"]`);
  return { fixture, q };
}

describe('BankIncomeInbox', () => {
  it('aucun revenu à saisir : rien n’est affiché', () => {
    const { q } = render([]);

    expect(q('pending-incomes')).toBeNull();
  });

  it('parle de « reçu » : on confirme un revenu, ou on dit qu’il n’est pas encore arrivé', () => {
    const { q } = render([income('salaire', null)]);

    expect(q('confirm-salaire')?.textContent).toContain('budget.bankAccount.pending.received');
    expect(q('ignore-salaire')?.textContent).toContain('budget.bankAccount.pending.notReceived');
  });

  it('salaire variable : champ vide, bouton inactif tant qu’aucun montant n’est saisi, puis émis', async () => {
    const { fixture, q } = render([income('salaire', null)]);
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
    button.click();

    expect(emitted).toEqual({ id: 'salaire', amount: 2050.4 });
  });

  it('« Pas encore reçu » écarte la ligne', () => {
    const { fixture, q } = render([income('salaire', null)]);
    let ignored: string | undefined;
    fixture.componentInstance.ignore.subscribe((id) => (ignored = id));

    q('ignore-salaire')!.click();

    expect(ignored).toBe('salaire');
  });
});
