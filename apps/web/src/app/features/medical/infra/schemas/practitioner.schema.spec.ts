import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { PractitionerSchema } from './practitioner.schema';

const VALID = {
  id: 'pr1',
  name: 'Dr House',
  type: 'generaliste',
  phone: null,
  email: null,
  address: null,
  bookingUrl: null,
};

describe('PractitionerSchema', () => {
  it('accepte un praticien conforme', () => {
    expect(z.safeParse(PractitionerSchema, VALID).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { name: _omit, ...rest } = VALID;
    expect(z.safeParse(PractitionerSchema, rest).success).toBe(false);
  });
  it("rejette un type d'enum inconnu", () => {
    expect(z.safeParse(PractitionerSchema, { ...VALID, type: 'sorcier' }).success).toBe(false);
  });
});
