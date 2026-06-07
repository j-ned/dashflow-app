import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { EnvelopeSchema } from './envelope.schema';

const VALID = {
  id: 'e1', memberId: null, name: 'Vacances', type: 'vacances',
  balance: 0, target: 500, color: '#fff', dueDay: null,
};

describe('EnvelopeSchema', () => {
  it('accepte une enveloppe conforme', () => {
    expect(z.safeParse(EnvelopeSchema, VALID).success).toBe(true);
  });
  it('rejette un type inconnu', () => {
    expect(z.safeParse(EnvelopeSchema, { ...VALID, type: 'autre' }).success).toBe(false);
  });
  it('rejette un balance non numérique', () => {
    expect(z.safeParse(EnvelopeSchema, { ...VALID, balance: '0' }).success).toBe(false);
  });
});
