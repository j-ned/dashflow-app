import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { PatientForm } from './patient-form';
import { Patient } from '../../domain/models/patient.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Patient, 'id'>) => void) => void };
};

const PATIENT: Patient = {
  id: 'p1',
  firstName: 'Jean',
  lastName: 'Valjean',
  birthDate: '1769-01-01',
  notes: 'RAS',
};

function make(initial: Patient | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(PatientForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(PatientForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('PatientForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un patient initial valide, when submit, then émet le payload sans id', async () => {
    const { fixture, cmp } = make(PATIENT);
    let emitted: Omit<Patient, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      firstName: 'Jean',
      lastName: 'Valjean',
      birthDate: '1769-01-01',
      notes: 'RAS',
    });
  });

  it('given des notes vides, when submit, then émet notes = null', async () => {
    const { fixture, cmp } = make({ ...PATIENT, notes: null });
    let emitted: Omit<Patient, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.notes).toBeNull();
  });
});
