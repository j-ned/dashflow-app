import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { CreditEnvelopeForm } from './credit-envelope-form';

type CreditPayload = {
  amount: number;
  date: string;
  note: string | null;
  accountId: string | null;
};

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: CreditPayload) => void) => void };
};

function make() {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(CreditEnvelopeForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(CreditEnvelopeForm);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('CreditEnvelopeForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given le modèle par défaut (amount 0), when submit, then émet le payload avec note null', async () => {
    const { fixture, cmp } = make();
    let emitted: CreditPayload | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toBeDefined();
    expect(emitted?.amount).toBe(0);
    expect(typeof emitted?.date).toBe('string');
    expect(emitted?.note).toBeNull();
    expect(emitted?.accountId).toBeNull();
  });

  it('given un submit valide, when soumis, then n’appelle qu’une fois submitted', async () => {
    const { fixture, cmp } = make();
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
