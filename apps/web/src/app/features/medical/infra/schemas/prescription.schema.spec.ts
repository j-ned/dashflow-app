import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { PrescriptionSchema } from './prescription.schema';

const VALID = {
  id: 'rx1',
  appointmentId: null,
  practitionerId: null,
  patientId: 'p1',
  issuedDate: '2026-06-07',
  validUntil: null,
  documentUrl: null,
  notes: null,
};

describe('PrescriptionSchema', () => {
  it('accepte une ordonnance conforme', () => {
    expect(z.safeParse(PrescriptionSchema, VALID).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { patientId: _omit, ...rest } = VALID;
    expect(z.safeParse(PrescriptionSchema, rest).success).toBe(false);
  });
});
