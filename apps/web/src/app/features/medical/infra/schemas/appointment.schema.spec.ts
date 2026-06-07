import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { AppointmentSchema } from './appointment.schema';

const VALID = {
  id: 'a1',
  patientId: 'p1',
  practitionerId: 'pr1',
  date: '2026-06-07',
  time: '10:00',
  status: 'scheduled',
  reason: null,
  outcome: null,
};

describe('AppointmentSchema', () => {
  it('accepte un rendez-vous conforme', () => {
    expect(z.safeParse(AppointmentSchema, VALID).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { date: _omit, ...rest } = VALID;
    expect(z.safeParse(AppointmentSchema, rest).success).toBe(false);
  });
  it("rejette un statut d'enum inconnu", () => {
    expect(z.safeParse(AppointmentSchema, { ...VALID, status: 'pending' }).success).toBe(false);
  });
});
