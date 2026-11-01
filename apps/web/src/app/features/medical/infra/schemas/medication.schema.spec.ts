import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { MedicationSchema } from './medication.schema';

const VALID = {
  id: 'm1',
  prescriptionId: null,
  patientId: 'p1',
  name: 'Doliprane',
  type: 'comprime',
  dosage: '500mg',
  quantity: 20,
  dailyRate: 2,
  startDate: '2026-06-07',
  alertDaysBefore: 3,
  skipDays: [0, 6],
};

describe('MedicationSchema', () => {
  it('accepte un médicament conforme', () => {
    expect(z.safeParse(MedicationSchema, VALID).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { name: _omit, ...rest } = VALID;
    expect(z.safeParse(MedicationSchema, rest).success).toBe(false);
  });
  it("rejette un type d'enum inconnu", () => {
    expect(z.safeParse(MedicationSchema, { ...VALID, type: 'poudre' }).success).toBe(false);
  });
  it('rejette une quantité non numérique', () => {
    expect(z.safeParse(MedicationSchema, { ...VALID, quantity: '20' }).success).toBe(false);
  });
});
