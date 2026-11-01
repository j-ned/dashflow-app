import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { PrescriptionForm, PrescriptionSubmitData } from './prescription-form';
import { Prescription } from '../../domain/models/prescription.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: PrescriptionSubmitData) => void) => void };
};

const PRESCRIPTION: Prescription = {
  id: 'rx1',
  patientId: 'p1',
  practitionerId: 'pr1',
  appointmentId: 'a1',
  issuedDate: '2026-01-15',
  validUntil: '2026-07-15',
  documentUrl: null,
  notes: 'Renouvellement',
};

function make(initial: Prescription | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(PrescriptionForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(PrescriptionForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('PrescriptionForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given une ordonnance initiale valide, when submit, then émet le payload sans id ni documentUrl', async () => {
    const { fixture, cmp } = make(PRESCRIPTION);
    let emitted: PrescriptionSubmitData | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      data: {
        patientId: 'p1',
        practitionerId: 'pr1',
        appointmentId: 'a1',
        issuedDate: '2026-01-15',
        validUntil: '2026-07-15',
        notes: 'Renouvellement',
      },
      file: null,
    });
  });

  it('given des champs optionnels vides, when submit, then émet null pour ces champs', async () => {
    const { fixture, cmp } = make({
      ...PRESCRIPTION,
      practitionerId: null,
      appointmentId: null,
      validUntil: null,
      notes: null,
    });
    let emitted: PrescriptionSubmitData | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.data.practitionerId).toBeNull();
    expect(emitted?.data.appointmentId).toBeNull();
    expect(emitted?.data.validUntil).toBeNull();
    expect(emitted?.data.notes).toBeNull();
  });
});
