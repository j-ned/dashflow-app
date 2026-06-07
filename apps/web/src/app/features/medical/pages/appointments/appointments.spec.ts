import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { Appointment, AppointmentStatus } from '../../domain/models/appointment.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';
import { Appointments } from './appointments';

const APPOINTMENT: Appointment = {
  id: 'a1',
  patientId: 'pat1',
  practitionerId: 'pr1',
  date: '2026-06-10',
  time: '09:30',
  status: 'scheduled',
  reason: 'Consultation',
  outcome: null,
};

const NEW_DATA: Omit<Appointment, 'id'> = {
  patientId: 'pat1',
  practitionerId: 'pr1',
  date: '2026-06-10',
  time: '09:30',
  status: 'scheduled',
  reason: 'Consultation',
  outcome: null,
};

const PATIENT: Patient = {
  id: 'pat1',
  firstName: 'Jean',
  lastName: 'Valjean',
  birthDate: '1980-01-01',
  notes: null,
};

const PRACTITIONER: Practitioner = {
  id: 'pr1',
  name: 'Dr House',
  type: 'generaliste',
  phone: null,
  email: null,
  address: null,
  bookingUrl: null,
};

type Cmp = {
  createAppointment: (data: Omit<Appointment, 'id'>) => Promise<void>;
  updateAppointment: (data: Omit<Appointment, 'id'>) => Promise<void>;
  updateStatus: (id: string, status: AppointmentStatus) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;
  patientName: (id: string) => string;
  practitionerName: (id: string) => string;
  selectedAppointment: { set: (v: Appointment | null) => void };
};

function make(
  opts: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    updateStatus?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    getAll?: ReturnType<typeof vi.fn>;
    patientsGetAll?: ReturnType<typeof vi.fn>;
    practitionersGetAll?: ReturnType<typeof vi.fn>;
    confirm?: () => Promise<boolean>;
  } = {},
) {
  const getAll = opts.getAll ?? vi.fn(() => of([APPOINTMENT]));
  const create = opts.create ?? vi.fn(() => of(APPOINTMENT));
  const update = opts.update ?? vi.fn(() => of(APPOINTMENT));
  const updateStatus = opts.updateStatus ?? vi.fn(() => of(APPOINTMENT));
  const del = opts.del ?? vi.fn(() => of(undefined));
  const patientsGetAll = opts.patientsGetAll ?? vi.fn(() => of([PATIENT]));
  const practitionersGetAll = opts.practitionersGetAll ?? vi.fn(() => of([PRACTITIONER]));
  const success = vi.fn();
  const error = vi.fn();
  const createModalClose = vi.fn();
  const editModalClose = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: AppointmentGateway,
        useValue: { getAll, create, update, updateStatus, delete: del },
      },
      { provide: PatientGateway, useValue: { getAll: patientsGetAll } },
      { provide: PractitionerGateway, useValue: { getAll: practitionersGetAll } },
      { provide: Toaster, useValue: { success, error } },
      {
        provide: ConfirmService,
        useValue: { delete: opts.confirm ?? (() => Promise.resolve(true)) },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Appointments, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Appointments);

  // Stub the required viewChild modals so open()/close() ne plantent pas
  // (le template est blanchi, les vrais refs ne sont jamais résolus).
  const refs = fixture.componentInstance as unknown as {
    createModalRef: () => { open: () => void; close: () => void };
    editModalRef: () => { open: () => void; close: () => void };
  };
  refs.createModalRef = () => ({ open: vi.fn(), close: createModalClose });
  refs.editModalRef = () => ({ open: vi.fn(), close: editModalClose });

  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    getAll,
    create,
    update,
    updateStatus,
    del,
    success,
    error,
    createModalClose,
    editModalClose,
  };
}

describe('Appointments', () => {
  it('updateStatus : scheduled→completed → updateStatus(id, "completed"), toast statusUpdated, refetch', async () => {
    const { fixture, cmp, updateStatus, success, getAll } = make();
    const callsBefore = getAll.mock.calls.length;

    await cmp.updateStatus('a1', 'completed');
    // _refresh.update relance le switchMap : flush la CD pour observer le refetch.
    fixture.detectChanges();
    await fixture.whenStable();

    expect(updateStatus).toHaveBeenCalledWith('a1', 'completed');
    expect(success).toHaveBeenCalledWith('medical.appointment.feedback.statusUpdated');
    expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('updateStatus : scheduled→cancelled → updateStatus(id, "cancelled"), toast statusUpdated', async () => {
    const { cmp, updateStatus, success } = make();

    await cmp.updateStatus('a1', 'cancelled');

    expect(updateStatus).toHaveBeenCalledWith('a1', 'cancelled');
    expect(success).toHaveBeenCalledWith('medical.appointment.feedback.statusUpdated');
  });

  it('updateStatus : échec → toast statusFailed, pas de toast success, pas de crash', async () => {
    const { cmp, success, error } = make({
      updateStatus: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.updateStatus('a1', 'completed')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.appointment.feedback.statusFailed');
    expect(success).not.toHaveBeenCalled();
  });

  it('createAppointment : succès → create(data), toast created, modal fermée, refetch', async () => {
    const { fixture, cmp, create, success, createModalClose, getAll } = make();
    const callsBefore = getAll.mock.calls.length;

    await cmp.createAppointment(NEW_DATA);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(NEW_DATA);
    expect(success).toHaveBeenCalledWith('medical.appointment.feedback.created');
    expect(createModalClose).toHaveBeenCalledTimes(1);
    expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('createAppointment : échec → toast createFailed, modal NON fermée, pas de crash', async () => {
    const { cmp, success, error, createModalClose } = make({
      create: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.createAppointment(NEW_DATA)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.appointment.feedback.createFailed');
    expect(success).not.toHaveBeenCalled();
    expect(createModalClose).not.toHaveBeenCalled();
  });

  it('updateAppointment : sélectionné → update(id, data), toast updated, modal fermée', async () => {
    const { cmp, update, success, editModalClose } = make();
    cmp.selectedAppointment.set(APPOINTMENT);

    await cmp.updateAppointment(NEW_DATA);

    expect(update).toHaveBeenCalledWith('a1', NEW_DATA);
    expect(success).toHaveBeenCalledWith('medical.appointment.feedback.updated');
    expect(editModalClose).toHaveBeenCalledTimes(1);
  });

  it('updateAppointment : aucune sélection → ne fait rien (early return)', async () => {
    const { cmp, update, success, editModalClose } = make();
    cmp.selectedAppointment.set(null);

    await cmp.updateAppointment(NEW_DATA);

    expect(update).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(editModalClose).not.toHaveBeenCalled();
  });

  it('updateAppointment : échec → toast updateFailed, modal NON fermée, pas de crash', async () => {
    const { cmp, success, error, editModalClose } = make({
      update: vi.fn(() => throwError(() => new Error('boom'))),
    });
    cmp.selectedAppointment.set(APPOINTMENT);

    await expect(cmp.updateAppointment(NEW_DATA)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.appointment.feedback.updateFailed');
    expect(success).not.toHaveBeenCalled();
    expect(editModalClose).not.toHaveBeenCalled();
  });

  it('deleteAppointment : confirmé → delete(id) + toast deleted', async () => {
    const { cmp, del, success } = make({ confirm: () => Promise.resolve(true) });

    await cmp.deleteAppointment('a1');

    expect(del).toHaveBeenCalledWith('a1');
    expect(success).toHaveBeenCalledWith('medical.appointment.feedback.deleted');
  });

  it('deleteAppointment : annulé → delete NON appelé, aucun toast', async () => {
    const { cmp, del, success, error } = make({ confirm: () => Promise.resolve(false) });

    await cmp.deleteAppointment('a1');

    expect(del).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('deleteAppointment : confirmé mais delete échoue → toast deleteFailed, pas de crash', async () => {
    const { cmp, success, error } = make({
      confirm: () => Promise.resolve(true),
      del: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.deleteAppointment('a1')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.appointment.feedback.deleteFailed');
    expect(success).not.toHaveBeenCalled();
  });

  it('patientName : id connu → "prénom nom"', () => {
    const { cmp } = make();
    expect(cmp.patientName('pat1')).toBe('Jean Valjean');
  });

  it('patientName : id inconnu → retourne l’id en fallback', () => {
    const { cmp } = make();
    expect(cmp.patientName('ghost')).toBe('ghost');
  });

  it('practitionerName : id connu → nom du praticien', () => {
    const { cmp } = make();
    expect(cmp.practitionerName('pr1')).toBe('Dr House');
  });

  it('practitionerName : id inconnu → retourne l’id en fallback', () => {
    const { cmp } = make();
    expect(cmp.practitionerName('ghost')).toBe('ghost');
  });
});
