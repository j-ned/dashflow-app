import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { ReminderForm } from './reminder-form';
import { Reminder, ReminderTarget } from '../../domain/models/reminder.model';

type ReminderModel = {
  target: ReminderTarget;
  medicationId: string;
  appointmentId: string;
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

  it('given un form vide (aucune cible sélectionnée), when submit, then n’émet pas (gate de validité)', async () => {
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
      target: 'medication',
      medicationId: '',
      appointmentId: '',
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
      target: 'medication',
      medicationId: 'm1',
      appointmentId: '',
    });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      target: 'medication',
      medicationId: 'm1',
      appointmentId: null,
      enabled: true,
    });
  });

  it('given un rappel appointment valide, when submit, then émet le payload (medicationId null)', async () => {
    const { fixture, cmp } = make();
    let emitted: Omit<Reminder, 'id'> | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));
    cmp.model.set({
      target: 'appointment',
      medicationId: '',
      appointmentId: 'a1',
    });
    fixture.detectChanges();

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      target: 'appointment',
      medicationId: null,
      appointmentId: 'a1',
      enabled: true,
    });
  });
});
