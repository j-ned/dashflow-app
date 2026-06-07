import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { MedicationGateway } from '../../domain/gateways/medication.gateway';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PrescriptionGateway } from '../../domain/gateways/prescription.gateway';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { TranslocoService } from '@jsverse/transloco';
import { Medication } from '../../domain/models/medication.model';
import { Patient } from '../../domain/models/patient.model';
import { Medications } from './medications';

const MEDICATION: Medication = {
  id: 'm1',
  prescriptionId: null,
  patientId: 'pat1',
  name: 'Doliprane',
  type: 'comprime',
  dosage: '1000mg',
  quantity: 30,
  dailyRate: 1,
  startDate: '2026-01-01',
  alertDaysBefore: 7,
  skipDays: [],
};

const NEW_DATA: Omit<Medication, 'id'> = {
  prescriptionId: null,
  patientId: 'pat1',
  name: 'Doliprane',
  type: 'comprime',
  dosage: '1000mg',
  quantity: 30,
  dailyRate: 1,
  startDate: '2026-01-01',
  alertDaysBefore: 7,
  skipDays: [],
};

const PATIENT: Patient = {
  id: 'pat1',
  firstName: 'Jean',
  lastName: 'Valjean',
  birthDate: '1980-01-01',
  notes: null,
};

// dailyRate 0 → projection loop skipped → daysRemaining 0 ; alertDaysBefore 0 → 0 <= 0 → isLow true.
const LOW_MED: Medication = {
  ...MEDICATION,
  id: 'low',
  dailyRate: 0,
  alertDaysBefore: 0,
};

// startDate dans le futur lointain (rien consommé) + dailyRate > 0 + alertDaysBefore 0
// → daysRemaining très grand → isLow false, de façon déterministe quelle que soit la date courante.
const HEALTHY_MED: Medication = {
  ...MEDICATION,
  id: 'healthy',
  quantity: 100,
  dailyRate: 1,
  startDate: '2999-01-01',
  alertDaysBefore: 0,
  skipDays: [],
};

type Cmp = {
  createMedication: (data: Omit<Medication, 'id'>) => Promise<void>;
  updateMedication: (data: Omit<Medication, 'id'>) => Promise<void>;
  refillMedication: (event: { quantity: number }) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  patientName: (id: string) => string;
  medicationsWithStock: () => readonly { id: string; isLow: boolean; remainingQuantity: number }[];
  lowStockCount: () => number;
  selectedMedication: { set: (v: Medication | null) => void };
};

function make(
  opts: {
    create?: ReturnType<typeof vi.fn>;
    update?: ReturnType<typeof vi.fn>;
    refill?: ReturnType<typeof vi.fn>;
    del?: ReturnType<typeof vi.fn>;
    getAll?: ReturnType<typeof vi.fn>;
    patientsGetAll?: ReturnType<typeof vi.fn>;
    confirm?: () => Promise<boolean>;
  } = {},
) {
  const getAll = opts.getAll ?? vi.fn(() => of([MEDICATION]));
  const create = opts.create ?? vi.fn(() => of(MEDICATION));
  const update = opts.update ?? vi.fn(() => of(MEDICATION));
  const refill = opts.refill ?? vi.fn(() => of(MEDICATION));
  const del = opts.del ?? vi.fn(() => of(undefined));
  const patientsGetAll = opts.patientsGetAll ?? vi.fn(() => of([PATIENT]));
  const success = vi.fn();
  const error = vi.fn();
  const createModalClose = vi.fn();
  const editModalClose = vi.fn();
  const refillModalClose = vi.fn();

  TestBed.configureTestingModule({
    providers: [
      {
        provide: MedicationGateway,
        useValue: { getAll, create, update, refill, delete: del },
      },
      { provide: PatientGateway, useValue: { getAll: patientsGetAll } },
      { provide: PrescriptionGateway, useValue: { getAll: vi.fn(() => of([])) } },
      { provide: Toaster, useValue: { success, error } },
      {
        provide: ConfirmService,
        useValue: { delete: opts.confirm ?? (() => Promise.resolve(true)) },
      },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(Medications, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(Medications);

  // Stub the required viewChild modals so open()/close() ne plantent pas
  // (le template est blanchi, les vrais refs ne sont jamais résolus).
  const refs = fixture.componentInstance as unknown as {
    createModalRef: () => { open: () => void; close: () => void };
    editModalRef: () => { open: () => void; close: () => void };
    refillModalRef: () => { open: () => void; close: () => void };
  };
  refs.createModalRef = () => ({ open: vi.fn(), close: createModalClose });
  refs.editModalRef = () => ({ open: vi.fn(), close: editModalClose });
  refs.refillModalRef = () => ({ open: vi.fn(), close: refillModalClose });

  fixture.detectChanges();
  return {
    fixture,
    cmp: fixture.componentInstance as unknown as Cmp,
    getAll,
    create,
    update,
    refill,
    del,
    success,
    error,
    createModalClose,
    editModalClose,
    refillModalClose,
  };
}

describe('Medications', () => {
  it('createMedication : succès → create(data), toast success, modal fermée, refetch', async () => {
    const { fixture, cmp, create, success, createModalClose, getAll } = make();
    const callsBefore = getAll.mock.calls.length;

    await cmp.createMedication(NEW_DATA);
    // _refresh.update relance le switchMap : flush la CD pour observer le refetch.
    fixture.detectChanges();
    await fixture.whenStable();

    expect(create).toHaveBeenCalledWith(NEW_DATA);
    expect(success).toHaveBeenCalledWith('medical.medication.feedback.created');
    expect(createModalClose).toHaveBeenCalledTimes(1);
    expect(getAll.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('createMedication : échec → toast error, modal NON fermée, pas de crash', async () => {
    const { cmp, success, error, createModalClose } = make({
      create: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.createMedication(NEW_DATA)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.medication.feedback.createFailed');
    expect(success).not.toHaveBeenCalled();
    expect(createModalClose).not.toHaveBeenCalled();
  });

  it('updateMedication : sélectionné → update(id, data), toast success, modal fermée', async () => {
    const { cmp, update, success, editModalClose } = make();
    cmp.selectedMedication.set(MEDICATION);

    await cmp.updateMedication(NEW_DATA);

    expect(update).toHaveBeenCalledWith('m1', NEW_DATA);
    expect(success).toHaveBeenCalledWith('medical.medication.feedback.updated');
    expect(editModalClose).toHaveBeenCalledTimes(1);
  });

  it('updateMedication : aucune sélection → ne fait rien', async () => {
    const { cmp, update, success, editModalClose } = make();
    cmp.selectedMedication.set(null);

    await cmp.updateMedication(NEW_DATA);

    expect(update).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(editModalClose).not.toHaveBeenCalled();
  });

  it('updateMedication : échec → toast error, pas de crash', async () => {
    const { cmp, success, error } = make({
      update: vi.fn(() => throwError(() => new Error('boom'))),
    });
    cmp.selectedMedication.set(MEDICATION);

    await expect(cmp.updateMedication(NEW_DATA)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.medication.feedback.updateFailed');
    expect(success).not.toHaveBeenCalled();
  });

  it('refillMedication : sélectionné → refill(id, quantity), toast success, modal fermée', async () => {
    const { cmp, refill, success, refillModalClose } = make();
    cmp.selectedMedication.set(MEDICATION);

    await cmp.refillMedication({ quantity: 20 });

    expect(refill).toHaveBeenCalledWith('m1', 20);
    expect(success).toHaveBeenCalledWith('medical.medication.feedback.refilled');
    expect(refillModalClose).toHaveBeenCalledTimes(1);
  });

  it('refillMedication : aucune sélection → ne fait rien', async () => {
    const { cmp, refill, success } = make();
    cmp.selectedMedication.set(null);

    await cmp.refillMedication({ quantity: 20 });

    expect(refill).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });

  it('refillMedication : échec → toast error, pas de crash', async () => {
    const { cmp, success, error } = make({
      refill: vi.fn(() => throwError(() => new Error('boom'))),
    });
    cmp.selectedMedication.set(MEDICATION);

    await expect(cmp.refillMedication({ quantity: 20 })).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.medication.feedback.refillFailed');
    expect(success).not.toHaveBeenCalled();
  });

  it('deleteMedication : confirmé → delete(id) + toast success', async () => {
    const { cmp, del, success } = make({ confirm: () => Promise.resolve(true) });

    await cmp.deleteMedication('m1');

    expect(del).toHaveBeenCalledWith('m1');
    expect(success).toHaveBeenCalledWith('medical.medication.feedback.deleted');
  });

  it('deleteMedication : annulé → delete NON appelé, aucun toast', async () => {
    const { cmp, del, success, error } = make({ confirm: () => Promise.resolve(false) });

    await cmp.deleteMedication('m1');

    expect(del).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('deleteMedication : confirmé mais delete échoue → toast error, pas de crash', async () => {
    const { cmp, success, error } = make({
      confirm: () => Promise.resolve(true),
      del: vi.fn(() => throwError(() => new Error('boom'))),
    });

    await expect(cmp.deleteMedication('m1')).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith('medical.medication.feedback.deleteFailed');
    expect(success).not.toHaveBeenCalled();
  });

  it('patientName : id connu → "prénom nom"', () => {
    const { cmp } = make();
    expect(cmp.patientName('pat1')).toBe('Jean Valjean');
  });

  it('patientName : id inconnu → clé i18n unknownPatient', () => {
    const { cmp } = make();
    expect(cmp.patientName('ghost')).toBe('medical.medication.unknownPatient');
  });

  it('medicationsWithStock : mappe chaque med via computeMedicationStock (champs de stock dérivés)', () => {
    const { cmp } = make({ getAll: vi.fn(() => of([LOW_MED])) });

    const list = cmp.medicationsWithStock();
    expect(list).toHaveLength(1);
    // dailyRate 0 → rien consommé ni projeté → remainingQuantity = quantity, isLow (0 <= 0).
    expect(list[0]).toMatchObject({
      id: 'low',
      remainingQuantity: LOW_MED.quantity,
      isLow: true,
    });
  });

  it('lowStockCount : compte les meds en stock bas (déterministe)', () => {
    const { cmp } = make({ getAll: vi.fn(() => of([LOW_MED, HEALTHY_MED])) });

    expect(cmp.lowStockCount()).toBe(1);
    const ids = cmp.medicationsWithStock().filter((m) => m.isLow).map((m) => m.id);
    expect(ids).toEqual(['low']);
  });

  it('lowStockCount : aucun med bas → 0', () => {
    const { cmp } = make({ getAll: vi.fn(() => of([HEALTHY_MED])) });
    expect(cmp.lowStockCount()).toBe(0);
  });
});
