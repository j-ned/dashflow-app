import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PrescriptionGateway } from '../../domain/gateways/prescription.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { Prescription } from '../../domain/models/prescription.model';
import { PrescriptionSubmitData } from '../../components/prescription-form/prescription-form';
import { Prescriptions } from './prescriptions';

const PRESCRIPTION: Prescription = {
  id: 'p1',
  appointmentId: null,
  practitionerId: null,
  patientId: 'pat1',
  issuedDate: '2026-01-01',
  validUntil: '2999-12-31',
  documentUrl: null,
  notes: null,
};

const SUBMIT_DATA: PrescriptionSubmitData['data'] = {
  appointmentId: null,
  practitionerId: null,
  patientId: 'pat1',
  issuedDate: '2026-01-01',
  validUntil: '2999-12-31',
  notes: null,
};

const FILE = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

type Cmp = {
  createPrescription: (payload: PrescriptionSubmitData) => Promise<void>;
  updatePrescription: (payload: PrescriptionSubmitData) => Promise<void>;
  deletePrescription: (id: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  isExpired: (presc: Prescription) => boolean;
  selectedPrescription: { set: (v: Prescription | null) => void };
};

function make(
  opts: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    uploadDocument?: ReturnType<typeof vi.fn>;
    deleteDocument?: ReturnType<typeof vi.fn>;
    getAll?: ReturnType<typeof vi.fn>;
    confirmDelete?: () => Promise<boolean>;
    confirmConfirm?: () => Promise<boolean>;
  } = {},
) {
  const getAll = opts.getAll ?? vi.fn(() => of([PRESCRIPTION]));
  const create = opts.create ?? vi.fn(() => of({ ...PRESCRIPTION, id: 'new' }));
  const update = opts.update ?? vi.fn(() => of(PRESCRIPTION));
  const del = opts.del ?? vi.fn(() => of(undefined));
  const uploadDocument = opts.uploadDocument ?? vi.fn(() => of(PRESCRIPTION));
  const deleteDocument = opts.deleteDocument ?? vi.fn(() => of(undefined));
  const success = vi.fn();
  const error = vi.fn();
  const createModalClose = vi.fn();
  const editModalClose = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: PrescriptionGateway,
        useValue: { getAll, create, update, delete: del, uploadDocument, deleteDocument },
      },
      { provide: PatientGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: PractitionerGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: AppointmentGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: Toaster, useValue: { success, error } },
      {
        provide: ConfirmService,
        useValue: {
          delete: opts.confirmDelete ?? (() => Promise.resolve(true)),
          confirm: opts.confirmConfirm ?? (() => Promise.resolve(true)),
        },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Prescriptions, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Prescriptions);

  // Stub the required viewChild modals so open()/close() do not blow up
  // (the template is blanked, so the real refs are never resolved).
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
    del,
    uploadDocument,
    deleteDocument,
    success,
    error,
    createModalClose,
    editModalClose,
  };
}

describe('Prescriptions', () => {
  it('createPrescription sans fichier : create(data) appelé, toast success, modal fermée, refetch, pas d’upload', async () => {
    const { fixture, cmp, create, uploadDocument, success, createModalClose, getAll } = make();
    const callsBefore = getAll.mock.calls.length;

    await cmp.createPrescription({ data: SUBMIT_DATA, file: null });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(SUBMIT_DATA);
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('medical.prescription.feedback.created');
    expect(createModalClose).toHaveBeenCalledTimes(1);
    expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('createPrescription avec fichier : create puis uploadDocument(newId, file), toast success, modal fermée', async () => {
    const { cmp, create, uploadDocument, success, createModalClose } = make();

    await cmp.createPrescription({ data: SUBMIT_DATA, file: FILE });

    expect(create).toHaveBeenCalledWith(SUBMIT_DATA);
    expect(uploadDocument).toHaveBeenCalledWith('new', FILE);
    expect(success).toHaveBeenCalledWith('medical.prescription.feedback.created');
    expect(createModalClose).toHaveBeenCalledTimes(1);
  });

  it('createPrescription : create échoue → toast error, pas d’upload, modal NON fermée', async () => {
    const { cmp, uploadDocument, success, error, createModalClose } = make({
      create: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(
      cmp.createPrescription({ data: SUBMIT_DATA, file: FILE }),
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.prescription.feedback.createFailed');
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(createModalClose).not.toHaveBeenCalled();
  });

  it('createPrescription : upload échoue après create OK → toast documentAddFailed, modal NON fermée (succès partiel)', async () => {
    const { cmp, create, success, error, createModalClose } = make({
      uploadDocument: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(
      cmp.createPrescription({ data: SUBMIT_DATA, file: FILE }),
    ).resolves.toBeUndefined();

    expect(create).toHaveBeenCalledWith(SUBMIT_DATA);
    expect(error).toHaveBeenCalledWith('medical.prescription.feedback.documentAddFailed');
    expect(success).not.toHaveBeenCalled();
    expect(createModalClose).not.toHaveBeenCalled();
  });

  it('updatePrescription : sélectionnée + sans fichier → update(id, data), toast success, modal fermée', async () => {
    const { cmp, update, uploadDocument, success, editModalClose } = make();
    cmp.selectedPrescription.set(PRESCRIPTION);

    await cmp.updatePrescription({ data: SUBMIT_DATA, file: null });

    expect(update).toHaveBeenCalledWith('p1', SUBMIT_DATA);
    expect(uploadDocument).not.toHaveBeenCalled();
    expect(success).toHaveBeenCalledWith('medical.prescription.feedback.updated');
    expect(editModalClose).toHaveBeenCalledTimes(1);
  });

  it('updatePrescription : aucune sélection → ne fait rien', async () => {
    const { cmp, update } = make();
    cmp.selectedPrescription.set(null);

    await cmp.updatePrescription({ data: SUBMIT_DATA, file: null });

    expect(update).not.toHaveBeenCalled();
  });

  it('deletePrescription : confirmé → delete(id) + toast success', async () => {
    const { cmp, del, success } = make({ confirmDelete: () => Promise.resolve(true) });

    await cmp.deletePrescription('p1');

    expect(del).toHaveBeenCalledWith('p1');
    expect(success).toHaveBeenCalledWith('medical.prescription.feedback.deleted');
  });

  it('deletePrescription : annulé → delete NON appelé, aucun toast', async () => {
    const { cmp, del, success, error } = make({ confirmDelete: () => Promise.resolve(false) });

    await cmp.deletePrescription('p1');

    expect(del).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('deleteDocument : confirmé → deleteDocument(id) + toast success', async () => {
    const { cmp, deleteDocument, success } = make({ confirmConfirm: () => Promise.resolve(true) });

    await cmp.deleteDocument('p1');

    expect(deleteDocument).toHaveBeenCalledWith('p1');
    expect(success).toHaveBeenCalledWith('medical.prescription.feedback.documentRemoved');
  });

  it('deleteDocument : annulé → deleteDocument NON appelé, aucun toast', async () => {
    const { cmp, deleteDocument, success, error } = make({
      confirmConfirm: () => Promise.resolve(false),
    });

    await cmp.deleteDocument('p1');

    expect(deleteDocument).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('isExpired : validUntil null → false', () => {
    const { cmp } = make();
    expect(cmp.isExpired({ ...PRESCRIPTION, validUntil: null })).toBe(false);
  });

  it('isExpired : validUntil passé → true', () => {
    const { cmp } = make();
    expect(cmp.isExpired({ ...PRESCRIPTION, validUntil: '2000-01-01' })).toBe(true);
  });

  it('isExpired : validUntil futur → false', () => {
    const { cmp } = make();
    expect(cmp.isExpired({ ...PRESCRIPTION, validUntil: '2999-12-31' })).toBe(false);
  });
});
