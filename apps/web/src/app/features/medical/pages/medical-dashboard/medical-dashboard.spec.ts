import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { TranslocoService } from '@jsverse/transloco';
import { PatientGateway } from '../../domain/gateways/patient.gateway';
import { PractitionerGateway } from '../../domain/gateways/practitioner.gateway';
import { AppointmentGateway } from '../../domain/gateways/appointment.gateway';
import { PrescriptionGateway } from '../../domain/gateways/prescription.gateway';
import { MedicationGateway } from '../../domain/gateways/medication.gateway';
import { Patient } from '../../domain/models/patient.model';
import { Appointment } from '../../domain/models/appointment.model';
import { Prescription } from '../../domain/models/prescription.model';
import { Medication } from '../../domain/models/medication.model';
import { Practitioner } from '../../domain/models/practitioner.model';
import { MedicalDashboard } from './medical-dashboard';

// Narrow view of the protected/private surface we characterize.
type PatientSummary = {
  patient: Patient;
  age: number;
  nextAppointments: Appointment[];
  activePrescriptions: Prescription[];
  medications: { id: string; isLow: boolean; daysRemaining: number }[];
  lowStockCount: number;
};

type Cmp = {
  patientSummaries: () => PatientSummary[];
  totalUpcomingAppointments: () => number;
  totalActivePrescriptions: () => number;
  totalLowStock: () => number;
  getPractitionerName: (id: string) => string;
  _today: () => string;
};

// Dates chosen far in the past / future so they stay on the correct side of
// the component's hardcoded `today` snapshot regardless of when tests run.
const PAST = '2000-01-01';
const FUTURE = '2999-12-31';

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 'p1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    birthDate: PAST,
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

// Low-stock med: dailyRate 0 => daysRemaining stays 0 => isLow (0 <= alertDaysBefore).
function lowMed(over: Partial<Medication> = {}): Medication {
  return {
    id: 'm-low',
    prescriptionId: null,
    patientId: 'p1',
    name: 'Doliprane',
    type: 'comprime',
    dosage: '1000mg',
    quantity: 10,
    dailyRate: 0,
    startDate: PAST,
    alertDaysBefore: 7,
    skipDays: [],
    ...over,
  };
}

// Healthy med: future startDate (nothing consumed) + real dailyRate + alertDaysBefore 0
// => large daysRemaining, isLow = (daysRemaining <= 0) = false.
function okMed(over: Partial<Medication> = {}): Medication {
  return {
    id: 'm-ok',
    prescriptionId: null,
    patientId: 'p1',
    name: 'Vitamine D',
    type: 'comprime',
    dosage: '1000UI',
    quantity: 90,
    dailyRate: 1,
    startDate: FUTURE,
    alertDaysBefore: 0,
    skipDays: [],
    ...over,
  };
}

function practitioner(over: Partial<Practitioner> = {}): Practitioner {
  return {
    id: 'pr1',
    name: 'Dr House',
    type: 'generaliste',
    phone: null,
    email: null,
    address: null,
    bookingUrl: null,
    ...over,
  };
}

function make(
  data: {
    patients?: Patient[];
    practitioners?: Practitioner[];
    appointments?: Appointment[];
    prescriptions?: Prescription[];
    medications?: Medication[];
  } = {},
) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PatientGateway, useValue: { getAll: () => of(data.patients ?? []) } },
      { provide: PractitionerGateway, useValue: { getAll: () => of(data.practitioners ?? []) } },
      { provide: AppointmentGateway, useValue: { getAll: () => of(data.appointments ?? []) } },
      {
        provide: PrescriptionGateway,
        useValue: {
          getAll: () => of(data.prescriptions ?? []),
          downloadDocument: () => of(new Blob()),
        },
      },
      { provide: MedicationGateway, useValue: { getAll: () => of(data.medications ?? []) } },
      { provide: TranslocoService, useValue: { translate: (k: string) => k } },
    ],
  });
  TestBed.overrideComponent(MedicalDashboard, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(MedicalDashboard);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('MedicalDashboard', () => {
  it('recalcule patientSummaries quand le jour bascule (today réactif à minuit UTC)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-07T12:00:00.000Z'));
    try {
      const { cmp } = make({
        patients: [patient()],
        appointments: [appointment({ id: 'todayAppt', date: '2026-06-07' })],
      });

      // Aujourd'hui = 2026-06-07 : le RDV du jour passe le filtre `date >= today`.
      expect(cmp.patientSummaries()[0].nextAppointments.map((a) => a.id)).toEqual(['todayAppt']);

      // Franchit minuit UTC -> today devient 2026-06-08, le RDV d'hier sort (sans refetch ni CD manuel).
      vi.advanceTimersByTime(13 * 60 * 60 * 1000);
      expect(cmp.patientSummaries()[0].nextAppointments).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  describe('patientSummaries — nextAppointments', () => {
    it('ne garde que les RDV futurs, planifiés, triés par date+heure et capés à 3', () => {
      const { cmp } = make({
        patients: [patient()],
        appointments: [
          appointment({ id: 'past', date: PAST }), // passé -> exclu
          appointment({ id: 'cancelled', status: 'cancelled' }), // futur mais annulé -> exclu
          appointment({ id: 'completed', status: 'completed' }), // futur mais terminé -> exclu
          appointment({ id: 'f4', date: '2999-12-05' }),
          appointment({ id: 'f2', date: '2999-12-02' }),
          appointment({ id: 'f1', date: '2999-12-01' }),
          appointment({ id: 'f3', date: '2999-12-03' }),
        ],
      });

      const next = cmp.patientSummaries()[0].nextAppointments;
      expect(next.map((a) => a.id)).toEqual(['f1', 'f2', 'f3']); // trié, cap 3, exclusions
    });

    it('départage par heure quand la date est identique', () => {
      const { cmp } = make({
        patients: [patient()],
        appointments: [
          appointment({ id: 'late', date: FUTURE, time: '14:00' }),
          appointment({ id: 'early', date: FUTURE, time: '08:00' }),
        ],
      });

      expect(cmp.patientSummaries()[0].nextAppointments.map((a) => a.id)).toEqual([
        'early',
        'late',
      ]);
    });

    it("n'inclut pas les RDV d'un autre patient", () => {
      const { cmp } = make({
        patients: [patient({ id: 'p1' })],
        appointments: [appointment({ id: 'other', patientId: 'p2' })],
      });

      expect(cmp.patientSummaries()[0].nextAppointments).toHaveLength(0);
    });
  });

  describe('patientSummaries — activePrescriptions', () => {
    it('filtre par validUntil (>= today ou null), trie par issuedDate desc, cap 3', () => {
      const { cmp } = make({
        patients: [patient()],
        prescriptions: [
          prescription({ id: 'expired', validUntil: PAST }), // expiré -> exclu
          prescription({ id: 'noEnd', validUntil: null, issuedDate: '2024-06-01' }),
          prescription({ id: 'old', validUntil: FUTURE, issuedDate: '2024-01-01' }),
          prescription({ id: 'recent', validUntil: FUTURE, issuedDate: '2024-12-01' }),
          prescription({ id: 'mid', validUntil: FUTURE, issuedDate: '2024-03-01' }),
        ],
      });

      const active = cmp.patientSummaries()[0].activePrescriptions;
      // issuedDate desc: recent(2024-12) > noEnd(2024-06) > mid(2024-03) > old(2024-01), cap 3
      expect(active.map((p) => p.id)).toEqual(['recent', 'noEnd', 'mid']);
    });
  });

  describe('patientSummaries — medications & lowStockCount', () => {
    it('trie par daysRemaining croissant et compte les meds en stock bas', () => {
      const { cmp } = make({
        patients: [patient()],
        medications: [okMed({ id: 'ok' }), lowMed({ id: 'low' })],
      });

      const summary = cmp.patientSummaries()[0];
      // lowMed a daysRemaining 0 -> en premier
      expect(summary.medications[0].id).toBe('low');
      expect(summary.medications[0].isLow).toBe(true);
      expect(summary.medications[1].isLow).toBe(false);
      expect(summary.lowStockCount).toBe(1);
    });
  });

  describe('totals across patients', () => {
    it('somme appointments / prescriptions / lowStock sur 2 patients', () => {
      const { cmp } = make({
        patients: [patient({ id: 'p1' }), patient({ id: 'p2' })],
        appointments: [
          appointment({ id: 'a-p1', patientId: 'p1' }),
          appointment({ id: 'a-p2a', patientId: 'p2' }),
          appointment({ id: 'a-p2b', patientId: 'p2', time: '10:00' }),
        ],
        prescriptions: [
          prescription({ id: 'rx-p1', patientId: 'p1' }),
          prescription({ id: 'rx-p2', patientId: 'p2' }),
        ],
        medications: [
          lowMed({ id: 'low-p1', patientId: 'p1' }),
          lowMed({ id: 'low-p2', patientId: 'p2' }),
          okMed({ id: 'ok-p2', patientId: 'p2' }),
        ],
      });

      expect(cmp.totalUpcomingAppointments()).toBe(3);
      expect(cmp.totalActivePrescriptions()).toBe(2);
      expect(cmp.totalLowStock()).toBe(2);
    });
  });

  describe('getPractitionerName', () => {
    it('retourne le nom pour un id connu', () => {
      const { cmp } = make({ practitioners: [practitioner({ id: 'pr1', name: 'Dr House' })] });
      expect(cmp.getPractitionerName('pr1')).toBe('Dr House');
    });

    it('retourne la clé i18n de fallback pour un id inconnu', () => {
      const { cmp } = make({ practitioners: [practitioner({ id: 'pr1' })] });
      expect(cmp.getPractitionerName('unknown')).toBe('medical.dashboard.unknownPractitioner');
    });
  });
});
