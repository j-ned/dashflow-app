import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { PractitionerForm } from './practitioner-form';
import { Practitioner } from '../../domain/models/practitioner.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Practitioner, 'id'>) => void) => void };
};

const PRACTITIONER: Practitioner = {
  id: 'pr1',
  name: 'Dr House',
  type: 'generaliste',
  phone: '0102030405',
  email: 'house@hospital.test',
  address: '1 rue de la Clinique',
  bookingUrl: 'https://www.doctolib.fr/house',
};

function make(initial: Practitioner | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(PractitionerForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(PractitionerForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('PractitionerForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un practitioner initial valide, when submit, then émet le payload sans id', async () => {
    const { fixture, cmp } = make(PRACTITIONER);
    let emitted: Omit<Practitioner, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      name: 'Dr House',
      type: 'generaliste',
      phone: '0102030405',
      email: 'house@hospital.test',
      address: '1 rue de la Clinique',
      bookingUrl: 'https://www.doctolib.fr/house',
    });
  });

  it('given des champs optionnels vides, when submit, then émet null pour ces champs', async () => {
    const { fixture, cmp } = make({
      ...PRACTITIONER,
      phone: null,
      email: null,
      address: null,
      bookingUrl: null,
    });
    let emitted: Omit<Practitioner, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.phone).toBeNull();
    expect(emitted?.email).toBeNull();
    expect(emitted?.address).toBeNull();
    expect(emitted?.bookingUrl).toBeNull();
  });
});
