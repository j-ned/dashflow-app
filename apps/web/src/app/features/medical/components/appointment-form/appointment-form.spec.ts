import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { AppointmentForm } from './appointment-form';
import { Appointment } from '../../domain/models/appointment.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Appointment, 'id'>) => void) => void };
};

const APPOINTMENT: Appointment = {
  id: 'a1',
  patientId: 'p1',
  practitionerId: 'pr1',
  date: '2026-07-01',
  time: '10:30',
  status: 'scheduled',
  reason: 'Consultation',
  outcome: null,
};

function make(initial: Appointment | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(AppointmentForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(AppointmentForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('AppointmentForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un rendez-vous initial valide, when submit, then émet le payload sans id', async () => {
    const { fixture, cmp } = make(APPOINTMENT);
    let emitted: Omit<Appointment, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      patientId: 'p1',
      practitionerId: 'pr1',
      date: '2026-07-01',
      time: '10:30',
      status: 'scheduled',
      reason: 'Consultation',
      outcome: null,
    });
  });

  it('given une raison vide, when submit, then émet reason = null', async () => {
    const { fixture, cmp } = make({ ...APPOINTMENT, reason: null });
    let emitted: Omit<Appointment, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.reason).toBeNull();
  });
});
