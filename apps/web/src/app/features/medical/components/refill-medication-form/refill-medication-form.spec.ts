import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { RefillMedicationForm } from './refill-medication-form';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: { quantity: number }) => void) => void };
};

function make() {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(RefillMedicationForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(RefillMedicationForm);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('RefillMedicationForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given le modèle valide par défaut (quantity 1), when submit, then émet { quantity: 1 }', async () => {
    const { fixture, cmp } = make();
    let emitted: { quantity: number } | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({ quantity: 1 });
  });

  it('given un submit, when le form est valide, then émet une seule fois', async () => {
    const { fixture, cmp } = make();
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ quantity: 1 });
  });
});
