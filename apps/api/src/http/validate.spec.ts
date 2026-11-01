import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { BadRequestError } from '../common/errors';
import { parseWith } from './validate';

const schema = z.object({ email: z.string().email() });

describe('parseWith', () => {
  it('laisse passer une valeur valide (parsée)', () => {
    expect(parseWith(schema, { email: 'a@b.com' })).toEqual({
      email: 'a@b.com',
    });
  });

  it('lève BadRequestError (400) sur valeur invalide', () => {
    expect(() => parseWith(schema, { email: 'nope' })).toThrow(BadRequestError);
  });
});
