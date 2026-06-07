import { describe, expect, it } from 'vitest';
import * as z from 'zod/mini';
import { MemberSchema } from './member.schema';

const VALID = { id: 'm1', firstName: 'Ada', lastName: 'L', color: null };

describe('MemberSchema', () => {
  it('accepte un membre conforme', () => {
    expect(z.safeParse(MemberSchema, VALID).success).toBe(true);
  });
  it('rejette un firstName manquant', () => {
    const { firstName: _omit, ...rest } = VALID;
    expect(z.safeParse(MemberSchema, rest).success).toBe(false);
  });
});
