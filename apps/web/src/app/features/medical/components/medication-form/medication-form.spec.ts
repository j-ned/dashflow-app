import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { MedicationForm } from './medication-form';
import { Medication } from '../../domain/models/medication.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Medication, 'id'>) => void) => void };
};

const MEDICATION: Medication = {
  id: 'm1',
  patientId: 'p1',
  prescriptionId: 'rx1',
  name: 'Doliprane',
  type: 'comprime',
  dosage: '500mg',
  quantity: 30,
  dailyRate: 3,
  startDate: '2026-01-01',
  alertDaysBefore: 7,
  skipDays: [0, 6],
};

function make(initial: Medication | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(MedicationForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(MedicationForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('MedicationForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un médicament initial valide, when submit, then émet le payload sans id', async () => {
    const { fixture, cmp } = make(MEDICATION);
    let emitted: Omit<Medication, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      patientId: 'p1',
      prescriptionId: 'rx1',
      name: 'Doliprane',
      type: 'comprime',
      dosage: '500mg',
      quantity: 30,
      dailyRate: 3,
      startDate: '2026-01-01',
      alertDaysBefore: 7,
      skipDays: [0, 6],
    });
  });

  it('given une prescription vide, when submit, then émet prescriptionId = null', async () => {
    const { fixture, cmp } = make({ ...MEDICATION, prescriptionId: null });
    let emitted: Omit<Medication, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.prescriptionId).toBeNull();
  });
});
