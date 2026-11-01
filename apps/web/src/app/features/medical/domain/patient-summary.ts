import { Patient } from './models/patient.model';
import { Appointment } from './models/appointment.model';
import { Prescription } from './models/prescription.model';
import { MedicationWithStock } from './models/medication.model';
import { computeAge } from './patient-age';

export type PatientSummary = {
  patient: Patient;
  age: number;
  nextAppointments: Appointment[];
  activePrescriptions: Prescription[];
  medications: MedicationWithStock[];
  lowStockCount: number;
};

type PatientData = {
  appointments: Appointment[];
  prescriptions: Prescription[];
  medications: MedicationWithStock[];
};

export function buildPatientSummary(
  patient: Patient,
  data: PatientData,
  today: string,
  now = new Date(),
): PatientSummary {
  const nextAppointments = data.appointments
    .filter((a) => a.patientId === patient.id && a.date >= today && a.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 3);

  const activePrescriptions = data.prescriptions
    .filter((p) => p.patientId === patient.id && (!p.validUntil || p.validUntil >= today))
    .sort((a, b) => b.issuedDate.localeCompare(a.issuedDate))
    .slice(0, 3);

  const medications = data.medications
    .filter((m) => m.patientId === patient.id)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  return {
    patient,
    age: computeAge(patient.birthDate, now),
    nextAppointments,
    activePrescriptions,
    medications,
    lowStockCount: medications.filter((m) => m.isLow).length,
  };
}
