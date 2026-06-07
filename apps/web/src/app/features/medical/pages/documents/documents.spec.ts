import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { DocumentGateway } from '../../domain/gateways/document.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { MedicalDocument } from '../../domain/models/document.model';
import { Patient } from '../../domain/models/patient.model';
import { Practitioner } from '../../domain/models/practitioner.model';
import { DocumentSubmitData } from '../../components/document-form/document-form';
import { Documents } from './documents';

const DOC_A: MedicalDocument = {
  id: 'd1',
  patientId: 'pat1',
  practitionerId: 'pr1',
  type: 'bilan',
  title: 'Bilan sanguin',
  date: '2026-01-01',
  fileUrl: null,
  notes: null,
};

const DOC_B: MedicalDocument = {
  id: 'd2',
  patientId: 'pat2',
  practitionerId: null,
  type: 'facture',
  title: 'Facture',
  date: '2026-02-01',
  fileUrl: 'http://x/file.pdf',
  notes: 'note',
};

const SUBMIT_DATA: DocumentSubmitData['data'] = {
  patientId: 'pat1',
  practitionerId: 'pr1',
  type: 'bilan',
  title: 'Bilan sanguin',
  date: '2026-01-01',
  notes: null,
};

const PATIENT_1: Patient = {
  id: 'pat1',
  firstName: 'Jean',
  lastName: 'Valjean',
  birthDate: '1980-01-01',
  notes: null,
};

const PATIENT_2: Patient = {
  id: 'pat2',
  firstName: 'Cosette',
  lastName: 'Fauchelevent',
  birthDate: '2000-01-01',
  notes: null,
};

const PRACTITIONER_1: Practitioner = {
  id: 'pr1',
  name: 'Dr House',
  type: 'generaliste',
  phone: null,
  email: null,
  address: null,
  bookingUrl: null,
};

const FILE = new File(['x'], 'doc.pdf', { type: 'application/pdf' });

type Cmp = {
  createDoc: (payload: DocumentSubmitData) => Promise<void>;
  updateDoc: (payload: DocumentSubmitData) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
  patientName: (id: string) => string;
  practitionerName: (id: string | null) => string | null;
  filteredDocuments: () => readonly MedicalDocument[];
  filterPatientId: { set: (v: string | null) => void };
  selectedDocument: { set: (v: MedicalDocument | null) => void };
};

function make(
  opts: {
    getAll?: ReturnType<typeof vi.fn>;
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    uploadFile?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    patientsGetAll?: ReturnType<typeof vi.fn>;
    practitionersGetAll?: ReturnType<typeof vi.fn>;
    confirm?: () => Promise<boolean>;
  } = {},
) {
  const getAll = opts.getAll ?? vi.fn(() => of([DOC_A, DOC_B]));
  const create = opts.create ?? vi.fn(() => of({ ...DOC_A, id: 'new' }));
  const update = opts.update ?? vi.fn(() => of(DOC_A));
  const uploadFile = opts.uploadFile ?? vi.fn(() => of(DOC_A));
  const del = opts.del ?? vi.fn(() => of(undefined));
  const patientsGetAll = opts.patientsGetAll ?? vi.fn(() => of([PATIENT_1, PATIENT_2]));
  const practitionersGetAll = opts.practitionersGetAll ?? vi.fn(() => of([PRACTITIONER_1]));
  const success = vi.fn();
  const error = vi.fn();
  const createModalClose = vi.fn();
  const editModalClose = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: DocumentGateway,
        useValue: { getAll, create, update, uploadFile, delete: del },
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
  TestBed.overrideComponent(Documents, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Documents);

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
    uploadFile,
    del,
    success,
    error,
    createModalClose,
    editModalClose,
  };
}

describe('Documents', () => {
  describe('filteredDocuments (patient filter)', () => {
    it('filterPatientId null → retourne tous les documents', () => {
      const { cmp } = make();
      cmp.filterPatientId.set(null);
      expect(cmp.filteredDocuments()).toEqual([DOC_A, DOC_B]);
    });

    it('filterPatientId défini → ne garde que les documents du patient (d.patientId === pid)', () => {
      const { cmp } = make();
      cmp.filterPatientId.set('pat1');
      const list = cmp.filteredDocuments();
      expect(list).toEqual([DOC_A]);
      expect(list.every((d) => d.patientId === 'pat1')).toBe(true);
    });

    it('filterPatientId sur patient sans document → liste vide', () => {
      const { cmp } = make();
      cmp.filterPatientId.set('ghost');
      expect(cmp.filteredDocuments()).toEqual([]);
    });
  });

  describe('name lookups', () => {
    it('patientName : id connu → "prénom nom"', () => {
      const { cmp } = make();
      expect(cmp.patientName('pat1')).toBe('Jean Valjean');
    });

    it('patientName : id inconnu → clé i18n unknownPatient', () => {
      const { cmp } = make();
      expect(cmp.patientName('ghost')).toBe('medical.document.unknownPatient');
    });

    it('practitionerName : id connu → nom du praticien', () => {
      const { cmp } = make();
      expect(cmp.practitionerName('pr1')).toBe('Dr House');
    });

    it('practitionerName : id null → null (pas de fallback i18n)', () => {
      const { cmp } = make();
      expect(cmp.practitionerName(null)).toBeNull();
    });

    it('practitionerName : id inconnu → null', () => {
      const { cmp } = make();
      expect(cmp.practitionerName('ghost')).toBeNull();
    });
  });

  describe('createDoc', () => {
    it('sans fichier : create(data), toast created, modal fermée, refetch, pas d’upload', async () => {
      const { fixture, cmp, create, uploadFile, success, createModalClose, getAll } = make();
      const callsBefore = getAll.mock.calls.length;

      await cmp.createDoc({ data: SUBMIT_DATA, file: null });
      fixture.detectChanges();
      await fixture.whenStable();

      expect(create).toHaveBeenCalledWith(SUBMIT_DATA);
      expect(uploadFile).not.toHaveBeenCalled();
      expect(success).toHaveBeenCalledWith('medical.document.feedback.created');
      expect(createModalClose).toHaveBeenCalledTimes(1);
      expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    it('avec fichier : create puis uploadFile(newId, file), toast created, modal fermée', async () => {
      const { cmp, create, uploadFile, success, createModalClose } = make();

      await cmp.createDoc({ data: SUBMIT_DATA, file: FILE });

      expect(create).toHaveBeenCalledWith(SUBMIT_DATA);
      expect(uploadFile).toHaveBeenCalledWith('new', FILE);
      expect(success).toHaveBeenCalledWith('medical.document.feedback.created');
      expect(createModalClose).toHaveBeenCalledTimes(1);
    });

    it('create échoue → toast createFailed, pas d’upload, modal NON fermée', async () => {
      const { cmp, uploadFile, success, error, createModalClose } = make({
        create: vi.fn(() => throwError(() => new Error('boom'))),
      });

      await expect(cmp.createDoc({ data: SUBMIT_DATA, file: FILE })).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith('medical.document.feedback.createFailed');
      expect(uploadFile).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      expect(createModalClose).not.toHaveBeenCalled();
    });

    it('upload échoue après create OK → toast fileAddFailed, modal fermée + refetch (succès partiel)', async () => {
      const { fixture, cmp, create, success, error, createModalClose, getAll } = make({
        uploadFile: vi.fn(() => throwError(() => new Error('boom'))),
      });
      const callsBefore = getAll.mock.calls.length;

      await expect(cmp.createDoc({ data: SUBMIT_DATA, file: FILE })).resolves.toBeUndefined();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(create).toHaveBeenCalledWith(SUBMIT_DATA);
      expect(error).toHaveBeenCalledWith('medical.document.feedback.fileAddFailed');
      expect(success).not.toHaveBeenCalled();
      expect(createModalClose).toHaveBeenCalledTimes(1);
      expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('updateDoc', () => {
    it('sélectionné + sans fichier → update(id, data), toast updated, modal fermée', async () => {
      const { cmp, update, uploadFile, success, editModalClose } = make();
      cmp.selectedDocument.set(DOC_A);

      await cmp.updateDoc({ data: SUBMIT_DATA, file: null });

      expect(update).toHaveBeenCalledWith('d1', SUBMIT_DATA);
      expect(uploadFile).not.toHaveBeenCalled();
      expect(success).toHaveBeenCalledWith('medical.document.feedback.updated');
      expect(editModalClose).toHaveBeenCalledTimes(1);
    });

    it('sélectionné + avec fichier → update puis uploadFile(id, file), toast updated', async () => {
      const { cmp, update, uploadFile, success, editModalClose } = make();
      cmp.selectedDocument.set(DOC_A);

      await cmp.updateDoc({ data: SUBMIT_DATA, file: FILE });

      expect(update).toHaveBeenCalledWith('d1', SUBMIT_DATA);
      expect(uploadFile).toHaveBeenCalledWith('d1', FILE);
      expect(success).toHaveBeenCalledWith('medical.document.feedback.updated');
      expect(editModalClose).toHaveBeenCalledTimes(1);
    });

    it('aucune sélection → ne fait rien', async () => {
      const { cmp, update, success } = make();
      cmp.selectedDocument.set(null);

      await cmp.updateDoc({ data: SUBMIT_DATA, file: null });

      expect(update).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
    });

    it('update échoue → toast updateFailed, pas de crash', async () => {
      const { cmp, success, error } = make({
        update: vi.fn(() => throwError(() => new Error('boom'))),
      });
      cmp.selectedDocument.set(DOC_A);

      await expect(cmp.updateDoc({ data: SUBMIT_DATA, file: null })).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith('medical.document.feedback.updateFailed');
      expect(success).not.toHaveBeenCalled();
    });

    it('upload échoue après update OK → toast fileAddFailed, modal fermée + refetch (succès partiel)', async () => {
      const { fixture, cmp, update, success, error, editModalClose, getAll } = make({
        uploadFile: vi.fn(() => throwError(() => new Error('boom'))),
      });
      cmp.selectedDocument.set(DOC_A);
      const callsBefore = getAll.mock.calls.length;

      await expect(cmp.updateDoc({ data: SUBMIT_DATA, file: FILE })).resolves.toBeUndefined();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(update).toHaveBeenCalledWith('d1', SUBMIT_DATA);
      expect(error).toHaveBeenCalledWith('medical.document.feedback.fileAddFailed');
      expect(success).not.toHaveBeenCalled();
      expect(editModalClose).toHaveBeenCalledTimes(1);
      expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('deleteDoc', () => {
    it('confirmé → delete(id) + toast deleted', async () => {
      const { cmp, del, success } = make({ confirm: () => Promise.resolve(true) });

      await cmp.deleteDoc('d1');

      expect(del).toHaveBeenCalledWith('d1');
      expect(success).toHaveBeenCalledWith('medical.document.feedback.deleted');
    });

    it('annulé → delete NON appelé, aucun toast', async () => {
      const { cmp, del, success, error } = make({ confirm: () => Promise.resolve(false) });

      await cmp.deleteDoc('d1');

      expect(del).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    });

    it('confirmé mais delete échoue → toast deleteFailed, pas de crash', async () => {
      const { cmp, success, error } = make({
        confirm: () => Promise.resolve(true),
        del: vi.fn(() => throwError(() => new Error('boom'))),
      });

      await expect(cmp.deleteDoc('d1')).resolves.toBeUndefined();

      expect(error).toHaveBeenCalledWith('medical.document.feedback.deleteFailed');
      expect(success).not.toHaveBeenCalled();
    });
  });
});
