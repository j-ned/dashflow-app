// backend/src/scripts/seed-demo/builders/medical.ts
import type { db } from '@db/client';
import {
  appointments,
  documents,
  medications,
  practitioners,
  prescriptions,
  reminders,
} from '@db/schema';
import type { Rng } from '../rng.js';
import { pick, intBetween } from '../rng.js';
import { PRACTITIONERS, APPOINTMENT_REASONS, MEDICATIONS, DOCUMENTS } from '../fixtures.js';
import type { SeededFamily } from './family.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MINOR_PRACTITIONER_TYPES = new Set(['pediatre', 'orthodontiste']);

function isMinor(birthDate: string): boolean {
  const age = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  return age < 18;
}

function dateOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export async function seedMedical(
  tx: Tx,
  userId: string,
  family: SeededFamily,
  rng: Rng,
): Promise<void> {
  // ── Practitioners ──
  const insertedPractitioners = await tx
    .insert(practitioners)
    .values(
      PRACTITIONERS.map((p) => ({
        userId,
        name: p.name,
        type: p.type as any,
        phone: p.phone,
        email: null,
        address: p.address,
      })),
    )
    .returning({ id: practitioners.id, type: practitioners.type });

  // ── Appointments (10 past + 10 upcoming = 20) ──
  type AppointmentInsert = typeof appointments.$inferInsert;
  const apptValues: AppointmentInsert[] = [];

  // 10 past: 8 completed, 1 cancelled, 1 no_show
  const pastStatuses: Array<'completed' | 'cancelled' | 'no_show'> = [
    'completed', 'completed', 'completed', 'completed',
    'completed', 'completed', 'completed', 'completed',
    'cancelled', 'no_show',
  ];
  for (let i = 0; i < 10; i++) {
    const practitioner = insertedPractitioners[i % insertedPractitioners.length]!;
    const eligiblePatients = MINOR_PRACTITIONER_TYPES.has(practitioner.type)
      ? family.patients.filter((p) => isMinor(p.birthDate))
      : family.patients;
    const patient = pick(rng, eligiblePatients);
    const reasons = APPOINTMENT_REASONS[practitioner.type] ?? ['Consultation'];
    apptValues.push({
      userId,
      patientId: patient.id,
      practitionerId: practitioner.id,
      date: dateOffset(-intBetween(rng, 5, 150)),
      time: `${String(intBetween(rng, 8, 18)).padStart(2, '0')}:${pick(rng, ['00', '15', '30', '45'])}`,
      status: pastStatuses[i]!,
      reason: pick(rng, reasons),
      outcome: pastStatuses[i] === 'completed' ? 'RAS, prochain contrôle dans 6 mois' : null,
    });
  }
  // 10 upcoming
  for (let i = 0; i < 10; i++) {
    const practitioner = insertedPractitioners[(i + 3) % insertedPractitioners.length]!;
    const eligiblePatients = MINOR_PRACTITIONER_TYPES.has(practitioner.type)
      ? family.patients.filter((p) => isMinor(p.birthDate))
      : family.patients;
    const patient = pick(rng, eligiblePatients);
    const reasons = APPOINTMENT_REASONS[practitioner.type] ?? ['Consultation'];
    apptValues.push({
      userId,
      patientId: patient.id,
      practitionerId: practitioner.id,
      date: dateOffset(intBetween(rng, 3, 90)),
      time: `${String(intBetween(rng, 8, 18)).padStart(2, '0')}:${pick(rng, ['00', '15', '30', '45'])}`,
      status: 'scheduled',
      reason: pick(rng, reasons),
      outcome: null,
    });
  }
  const insertedAppts = await tx
    .insert(appointments)
    .values(apptValues)
    .returning({
      id: appointments.id,
      status: appointments.status,
      patientId: appointments.patientId,
      practitionerId: appointments.practitionerId,
      date: appointments.date,
    });

  // ── Prescriptions (4 — linked to 4 most recent completed appts) ──
  const completedAppts = insertedAppts
    .filter((a) => a.status === 'completed')
    .slice(0, 4);
  const insertedPrescriptions = await tx
    .insert(prescriptions)
    .values(
      completedAppts.map((a) => ({
        userId,
        appointmentId: a.id,
        practitionerId: a.practitionerId,
        patientId: a.patientId,
        issuedDate: a.date,
        validUntil: dateOffset(intBetween(rng, 30, 180)),
        notes: 'Renouvelable selon l\'évolution',
      })),
    )
    .returning({ id: prescriptions.id, patientId: prescriptions.patientId });

  // ── Medications (6) ──
  await tx.insert(medications).values(
    MEDICATIONS.map((m, i) => {
      const patient = family.patients[m.patientIdx]!;
      const linkedPrescription = insertedPrescriptions.find((p) => p.patientId === patient.id);
      return {
        userId,
        prescriptionId: i < 4 && linkedPrescription ? linkedPrescription.id : null,
        patientId: patient.id,
        name: m.name,
        type: m.type as any,
        dosage: m.dosage,
        quantity: m.quantity,
        dailyRate: m.dailyRate,
        startDate: dateOffset(-intBetween(rng, 10, 60)),
        alertDaysBefore: m.alertDaysBefore,
        skipDays: [...m.skipDays],
      };
    }),
  );

  // ── Documents (8) ──
  await tx.insert(documents).values(
    DOCUMENTS.map((d) => ({
      userId,
      patientId: family.patients[d.patientIdx]!.id,
      practitionerId: d.practitionerIdx === null ? null : insertedPractitioners[d.practitionerIdx]!.id,
      type: d.type as any,
      title: d.title,
      date: dateOffset(-intBetween(rng, 10, 180)),
      fileUrl: null,
      notes: null,
    })),
  );

  // ── Reminders (3 — on 3 upcoming appts) ──
  const upcomingAppts = insertedAppts.filter((a) => a.status === 'scheduled').slice(0, 3);
  await tx.insert(reminders).values(
    upcomingAppts.map((a) => ({
      userId,
      type: 'email' as const,
      target: 'appointment' as const,
      appointmentId: a.id,
      medicationId: null,
      recipientEmail: 'demo@dashflow.app',
      enabled: true,
    })),
  );
}
