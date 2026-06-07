import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ReminderGateway } from '../../domain/gateways/reminder.gateway';
import { MedicationGateway } from '../../domain/gateways/medication.gateway';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { Reminder } from '../../domain/models/reminder.model';
import { Reminders } from './reminders';

const REMINDER: Reminder = {
  id: 'r1',
  type: 'email',
  target: 'medication',
  medicationId: 'm1',
  appointmentId: null,
  recipientEmail: 'a@b.c',
  enabled: true,
};

const NEW_DATA: Omit<Reminder, 'id'> = {
  type: 'email',
  target: 'medication',
  medicationId: 'm1',
  appointmentId: null,
  recipientEmail: 'a@b.c',
  enabled: true,
};

type Cmp = {
  createReminder: (data: Omit<Reminder, 'id'>) => Promise<void>;
  toggleReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;
};

function make(
  opts: {
    create?: ReturnType<typeof vi.fn>;
    toggle?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    getAll?: ReturnType<typeof vi.fn>;
    confirm?: () => Promise<boolean>;
  } = {},
) {
  const getAll = opts.getAll ?? vi.fn(() => of([REMINDER]));
  const create = opts.create ?? vi.fn(() => of(REMINDER));
  const toggle = opts.toggle ?? vi.fn(() => of(REMINDER));
  const del = opts.del ?? vi.fn(() => of(undefined));
  const success = vi.fn();
  const error = vi.fn();
  const modalClose = vi.fn();
  const modalOpen = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      { provide: ReminderGateway, useValue: { getAll, create, toggle, delete: del } },
      { provide: MedicationGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: AppointmentGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: PatientGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: PractitionerGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: Toaster, useValue: { success, error } },
      {
        provide: ConfirmService,
        useValue: { delete: opts.confirm ?? (() => Promise.resolve(true)) },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Reminders, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Reminders);

  // Stub the required viewChild modal so close()/open() do not blow up.
  const ref = fixture.componentInstance as unknown as {
    createReminderModalRef: () => { open: () => void; close: () => void };
  };
  ref.createReminderModalRef = () => ({ open: modalOpen, close: modalClose });

  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    getAll,
    create,
    toggle,
    del,
    success,
    error,
    modalClose,
  };
}

describe('Reminders', () => {
  it('createReminder : succès → create appelé avec data, toast success, modal fermée, refetch', async () => {
    const { fixture, cmp, create, success, modalClose, getAll } = make();
    const callsBefore = getAll.mock.calls.length;

    await cmp.createReminder(NEW_DATA);
    // _refreshReminders.update() relance le switchMap : flush la CD pour observer le refetch.
    fixture.detectChanges();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(NEW_DATA);
    expect(success).toHaveBeenCalledWith('medical.reminder.feedback.created');
    expect(modalClose).toHaveBeenCalledTimes(1);
    // _refreshReminders.update déclenche un nouveau switchMap → getAll re-appelé
    expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('createReminder : échec → toast error, modal NON fermée, pas de crash', async () => {
    const { cmp, success, error, modalClose } = make({
      create: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.createReminder(NEW_DATA)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.reminder.feedback.createFailed');
    expect(success).not.toHaveBeenCalled();
    expect(modalClose).not.toHaveBeenCalled();
  });

  it('toggleReminder : succès → toggle appelé avec id + toast success', async () => {
    const { cmp, toggle, success } = make();

    await cmp.toggleReminder('r1');

    expect(toggle).toHaveBeenCalledWith('r1');
    expect(success).toHaveBeenCalledWith('medical.reminder.feedback.updated');
  });

  it('toggleReminder : échec → toast error, pas de crash', async () => {
    const { cmp, success, error } = make({
      toggle: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.toggleReminder('r1')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.reminder.feedback.updateFailed');
    expect(success).not.toHaveBeenCalled();
  });

  it('deleteReminder : confirmé → delete appelé avec id + toast success', async () => {
    const { cmp, del, success } = make({ confirm: () => Promise.resolve(true) });

    await cmp.deleteReminder('r1');

    expect(del).toHaveBeenCalledWith('r1');
    expect(success).toHaveBeenCalledWith('medical.reminder.feedback.deleted');
  });

  it('deleteReminder : annulé → delete NON appelé, aucun toast', async () => {
    const { cmp, del, success, error } = make({ confirm: () => Promise.resolve(false) });

    await cmp.deleteReminder('r1');

    expect(del).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('deleteReminder : confirmé mais delete échoue → toast error, pas de crash', async () => {
    const { cmp, success, error } = make({
      confirm: () => Promise.resolve(true),
      del: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.deleteReminder('r1')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.reminder.feedback.deleteFailed');
    expect(success).not.toHaveBeenCalled();
  });
});
