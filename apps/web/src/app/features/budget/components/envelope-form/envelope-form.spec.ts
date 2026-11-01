import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { EnvelopeForm } from './envelope-form';
import { Envelope } from '../../domain/models/envelope.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Envelope, 'id'>) => void) => void };
};

const ENVELOPE: Envelope = {
  id: 'e1',
  memberId: 'm1',
  name: 'Vacances',
  type: 'vacances',
  balance: 1200,
  target: 3000,
  color: '#56a8f5',
  dueDay: 5,
};

function make(initial: Envelope | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(EnvelopeForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(EnvelopeForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('EnvelopeForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given une envelope initiale valide, when submit, then émet le payload sans id', async () => {
    const { fixture, cmp } = make(ENVELOPE);
    let emitted: Omit<Envelope, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      memberId: 'm1',
      name: 'Vacances',
      type: 'vacances',
      balance: 1200,
      target: 3000,
      color: '#56a8f5',
      dueDay: 5,
    });
  });

  it('given memberId nul (global), when submit, then émet memberId = null', async () => {
    const { fixture, cmp } = make({ ...ENVELOPE, memberId: null });
    let emitted: Omit<Envelope, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.memberId).toBeNull();
  });
});
