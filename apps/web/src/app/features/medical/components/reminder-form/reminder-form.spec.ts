import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { ReminderForm } from './reminder-form';
import { Reminder, ReminderTarget, ReminderType } from '../../domain/models/reminder.model';

type ReminderModel = {
  type: ReminderType;
  target: ReminderTarget;
  medicationId: string;
  appointmentId: string;
  recipientEmail: string;
};

type Cmp = {
  model: { set: (value: ReminderModel) => void };
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: Omit<Reminder, 'id'>) => void) => void };
};

function make() {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(ReminderForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(ReminderForm);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('ReminderForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (email cible requise manquante), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make();
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given une cible medication sans médicament sélectionné, when submit, then n’émet pas (required conditionnel)', async () => {
    const { fixture, cmp } = make();
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);
    cmp.model.set({
      type: 'email',
      target: 'medication',
      medicationId: '',
      appointmentId: '',
      recipientEmail: 'contact@dashflow.app',
    });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un rappel medication valide, when submit, then émet le payload (appointmentId null)', async () => {
    const { fixture, cmp } = make();
    let emitted: Omit<Reminder, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));
    cmp.model.set({
      type: 'email',
      target: 'medication',
      medicationId: 'm1',
      appointmentId: '',
      recipientEmail: 'contact@dashflow.app',
    });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      type: 'email',
      target: 'medication',
      medicationId: 'm1',
      appointmentId: null,
      recipientEmail: 'contact@dashflow.app',
      enabled: true,
    });
  });

  it('given un rappel appointment valide, when submit, then émet le payload (medicationId null)', async () => {
    const { fixture, cmp } = make();
    let emitted: Omit<Reminder, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));
    cmp.model.set({
      type: 'ical',
      target: 'appointment',
      medicationId: '',
      appointmentId: 'a1',
      recipientEmail: 'contact@dashflow.app',
    });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      type: 'ical',
      target: 'appointment',
      medicationId: null,
      appointmentId: 'a1',
      recipientEmail: 'contact@dashflow.app',
      enabled: true,
    });
  });
});
