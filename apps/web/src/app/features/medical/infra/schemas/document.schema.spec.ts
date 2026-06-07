import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { MedicalDocumentSchema } from './document.schema';

const VALID = {
  id: 'd1',
  patientId: 'p1',
  practitionerId: null,
  type: 'compte_rendu',
  title: 'Compte rendu',
  date: '2026-06-07',
  fileUrl: null,
  notes: null,
};

describe('MedicalDocumentSchema', () => {
  it('accepte un document conforme', () => {
    expect(z.safeParse(MedicalDocumentSchema, VALID).success).toBe(true);
  });
  it('rejette un champ requis manquant', () => {
    const { title: _omit, ...rest } = VALID;
    expect(z.safeParse(MedicalDocumentSchema, rest).success).toBe(false);
  });
  it("rejette un type d'enum inconnu", () => {
    expect(z.safeParse(MedicalDocumentSchema, { ...VALID, type: 'photo' }).success).toBe(false);
  });
});
