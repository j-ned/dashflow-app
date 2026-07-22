import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { RecordPaymentForm } from './record-payment-form';

type PaymentPayload = {
  amount: number;
  date: string;
  accountId: string | null;
  note: string | null;
};

type RecordPaymentModel = {
  amount: number;
  date: string;
  accountId: string;
  note: string;
};

type Cmp = {
  model: { set: (value: RecordPaymentModel) => void };
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: PaymentPayload) => void) => void };
};

function make() {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(RecordPaymentForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(RecordPaymentForm);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('RecordPaymentForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given le modèle par défaut (amount 0 < min), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make();
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un paiement valide, when submit, then émet le payload (accountId/note null)', async () => {
    const { fixture, cmp } = make();
    let emitted: PaymentPayload | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));
    cmp.model.set({ amount: 120.5, date: '2026-06-26', accountId: '', note: '' });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      amount: 120.5,
      date: '2026-06-26',
      accountId: null,
      note: null,
    });
  });

  it('given un compte et une note renseignés, when submit, then émet les valeurs trimées', async () => {
    const { fixture, cmp } = make();
    let emitted: PaymentPayload | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));
    cmp.model.set({
      amount: 50,
      date: '2026-06-26',
      accountId: 'acc-1',
      note: '  remboursement  ',
    });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.accountId).toBe('acc-1');
    expect(emitted?.note).toBe('remboursement');
  });

  it('given un submit valide, when soumis, then n’appelle qu’une fois submitted', async () => {
    const { fixture, cmp } = make();
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);
    cmp.model.set({ amount: 30, date: '2026-06-26', accountId: '', note: '' });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
