import { describe, expect, it } from 'vitest';
import { Patient } from './models/patient.model';
import { Appointment } from './models/appointment.model';
import { Prescription } from './models/prescription.model';
import { MedicationWithStock } from './models/medication.model';
import { buildPatientSummary } from './patient-summary';

const TODAY = '2026-06-07';
const PAST = '2000-01-01';
const FUTURE = '2999-12-31';
const NOW = new Date('2026-06-07T12:00:00.000Z');

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 'p1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    birthDate: '1990-01-01',
    notes: null,
    ...over,
  };
}

function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: 'a1',
    patientId: 'p1',
    practitionerId: 'pr1',
    date: FUTURE,
    time: '09:00',
    status: 'scheduled',
    reason: null,
    outcome: null,
    ...over,
  };
}

function prescription(over: Partial<Prescription> = {}): Prescription {
  return {
    id: 'rx1',
    appointmentId: null,
    practitionerId: 'pr1',
    patientId: 'p1',
    issuedDate: '2024-01-01',
    validUntil: FUTURE,
    documentUrl: null,
    notes: null,
    ...over,
  };
}

function med(over: Partial<MedicationWithStock> = {}): MedicationWithStock {
  return {
    id: 'm1',
    prescriptionId: null,
    patientId: 'p1',
    name: 'Doliprane',
    type: 'comprime',
    dosage: '1000mg',
    quantity: 10,
    dailyRate: 1,
    startDate: PAST,
    alertDaysBefore: 7,
    skipDays: [],
    consumedQuantity: 0,
    remainingQuantity: 10,
    daysRemaining: 10,
    takeDaysRemaining: 10,
    restDaysRemaining: 0,
    estimatedRunOut: '17 juin 2026',
    isLow: false,
    ...over,
  };
}

const EMPTY = { appointments: [], prescriptions: [], medications: [] };

describe('buildPatientSummary', () => {
  it("calcule l'âge du patient au `now` fourni", () => {
    const summary = buildPatientSummary(patient({ birthDate: '1990-12-01' }), EMPTY, TODAY, NOW);
    expect(summary.age).toBe(35);
  });

  describe('nextAppointments', () => {
    it('ne garde que les RDV futurs, planifiés, triés par date+heure et capés à 3', () => {
      const summary = buildPatientSummary(
        patient(),
        {
          ...EMPTY,
          appointments: [
            appointment({ id: 'past', date: PAST }),
            appointment({ id: 'cancelled', status: 'cancelled' }),
            appointment({ id: 'completed', status: 'completed' }),
            appointment({ id: 'f4', date: '2999-12-05' }),
            appointment({ id: 'f2', date: '2999-12-02' }),
            appointment({ id: 'f1', date: '2999-12-01' }),
            appointment({ id: 'f3', date: '2999-12-03' }),
          ],
        },
        TODAY,
        NOW,
      );

      expect(summary.nextAppointments.map((a) => a.id)).toEqual(['f1', 'f2', 'f3']);
    });

    it('départage par heure quand la date est identique', () => {
      const summary = buildPatientSummary(
        patient(),
        {
          ...EMPTY,
          appointments: [
            appointment({ id: 'late', date: FUTURE, time: '14:00' }),
            appointment({ id: 'early', date: FUTURE, time: '08:00' }),
          ],
        },
        TODAY,
        NOW,
      );

      expect(summary.nextAppointments.map((a) => a.id)).toEqual(['early', 'late']);
    });

    it('garde le RDV du jour même (date >= today)', () => {
      const summary = buildPatientSummary(
        patient(),
        { ...EMPTY, appointments: [appointment({ id: 'today', date: TODAY })] },
        TODAY,
        NOW,
      );

      expect(summary.nextAppointments.map((a) => a.id)).toEqual(['today']);
    });

    it("n'inclut pas les RDV d'un autre patient", () => {
      const summary = buildPatientSummary(
        patient({ id: 'p1' }),
        { ...EMPTY, appointments: [appointment({ id: 'other', patientId: 'p2' })] },
        TODAY,
        NOW,
      );

      expect(summary.nextAppointments).toHaveLength(0);
    });
  });

  describe('activePrescriptions', () => {
    it('filtre par validUntil (>= today ou null), trie par issuedDate desc, cap 3', () => {
      const summary = buildPatientSummary(
        patient(),
        {
          ...EMPTY,
          prescriptions: [
            prescription({ id: 'expired', validUntil: PAST }),
            prescription({ id: 'noEnd', validUntil: null, issuedDate: '2024-06-01' }),
            prescription({ id: 'old', validUntil: FUTURE, issuedDate: '2024-01-01' }),
            prescription({ id: 'recent', validUntil: FUTURE, issuedDate: '2024-12-01' }),
            prescription({ id: 'mid', validUntil: FUTURE, issuedDate: '2024-03-01' }),
          ],
        },
        TODAY,
        NOW,
      );

      expect(summary.activePrescriptions.map((p) => p.id)).toEqual(['recent', 'noEnd', 'mid']);
    });
  });

  describe('medications & lowStockCount', () => {
    it('trie par daysRemaining croissant et compte les meds en stock bas', () => {
      const summary = buildPatientSummary(
        patient(),
        {
          ...EMPTY,
          medications: [
            med({ id: 'ok', daysRemaining: 30, isLow: false }),
            med({ id: 'low', daysRemaining: 0, isLow: true }),
          ],
        },
        TODAY,
        NOW,
      );

      expect(summary.medications[0].id).toBe('low');
      expect(summary.medications[0].isLow).toBe(true);
      expect(summary.medications[1].isLow).toBe(false);
      expect(summary.lowStockCount).toBe(1);
    });

    it("n'inclut pas les meds d'un autre patient (pas de cap)", () => {
      const summary = buildPatientSummary(
        patient({ id: 'p1' }),
        {
          ...EMPTY,
          medications: [
            med({ id: 'm1', patientId: 'p1', daysRemaining: 1 }),
            med({ id: 'm2', patientId: 'p1', daysRemaining: 2 }),
            med({ id: 'm3', patientId: 'p1', daysRemaining: 3 }),
            med({ id: 'm4', patientId: 'p1', daysRemaining: 4 }),
            med({ id: 'other', patientId: 'p2', daysRemaining: 0 }),
          ],
        },
        TODAY,
        NOW,
      );

      expect(summary.medications.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    });
  });
});
