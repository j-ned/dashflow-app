import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { PatientSchema } from './patient.schema';

const VALID = {
  id: 'p1',
  firstName: 'Jean',
  lastName: 'Dupont',
  birthDate: '1990-01-01',
  notes: null,
};

describe('PatientSchema', () => {
  it('accepte un patient conforme', () => {
    expect(z.safeParse(PatientSchema, VALID).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { firstName: _omit, ...rest } = VALID;
    expect(z.safeParse(PatientSchema, rest).success).toBe(false);
  });
});
