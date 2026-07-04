import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({ email: z.string().email() });

describe('ZodValidationPipe', () => {
  it('laisse passer une valeur valide (parsée)', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ email: 'a@b.com' })).toEqual({ email: 'a@b.com' });
  });

  it('lève BadRequestException sur valeur invalide', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ email: 'nope' })).toThrow(
      BadRequestException,
    );
  });
});
