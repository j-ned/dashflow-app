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
  model: { set: (value: RecordPaymentModel) => void; (): RecordPaymentModel };
  payAll: (due: number) => void;
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

  describe('restant dû', () => {
    const payment = (amount: number): RecordPaymentModel => ({
      amount,
      date: '2026-09-20',
      accountId: '',
      note: '',
    });

    it.each([
      [800, true],
      [799.99, true],
      [800.01, false],
      [5000, false],
    ])('restant dû 800 € : un remboursement de %s € → émis : %s', async (amount, emitted) => {
      const { fixture, cmp } = make();
      fixture.componentRef.setInput('remaining', 800);
      const onSubmit = vi.fn();
      cmp.submitted.subscribe(onSubmit);
      cmp.model.set(payment(amount));
      fixture.detectChanges();

      await cmp.submitForm(new Event('submit'));
      await fixture.whenStable();

      expect(onSubmit).toHaveBeenCalledTimes(emitted ? 1 : 0);
    });

    it('sans restant dû connu : aucun plafond', async () => {
      const { fixture, cmp } = make();
      const onSubmit = vi.fn();
      cmp.submitted.subscribe(onSubmit);
      cmp.model.set(payment(5000));
      fixture.detectChanges();

      await cmp.submitForm(new Event('submit'));
      await fixture.whenStable();

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('« Tout rembourser » préremplit exactement le restant dû', () => {
      const { cmp } = make();

      cmp.payAll(812.37);

      expect(cmp.model().amount).toBe(812.37);
    });
  });
});
