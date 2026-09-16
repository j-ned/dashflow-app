import { describe, it, expect } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { normalizeException, pgErrorCode } from './http-exception.filter';

describe('HttpExceptionFilter : normalisation', () => {
  it('HttpException : message, code et details passent', () => {
    const n = normalizeException(
      new ConflictException({
        message: 'Données médicales liées',
        code: 'MEMBER_HAS_MEDICAL_DATA',
        details: { appointments: 2 },
      }),
    );
    expect(n).toEqual({
      status: 409,
      message: 'Données médicales liées',
      code: 'MEMBER_HAS_MEDICAL_DATA',
      details: { appointments: 2 },
    });
  });

  it('HttpException : message tableau (ValidationPipe) est joint', () => {
    const n = normalizeException(new BadRequestException(['a', 'b']));
    expect(n).toMatchObject({ status: 400, message: 'a, b' });
  });

  it('erreur Postgres nue (postgres-js) : 23505 → 409 UNIQUE_VIOLATION', () => {
    const err = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(normalizeException(err)).toMatchObject({
      status: 409,
      code: 'UNIQUE_VIOLATION',
    });
  });

  it('erreur Postgres enveloppée par drizzle (cause) : 23514 → 400 CHECK_VIOLATION', () => {
    const wrapped = new Error('Failed query', {
      cause: Object.assign(new Error('check'), { code: '23514' }),
    });
    expect(pgErrorCode(wrapped)).toBe('23514');
    expect(normalizeException(wrapped)).toMatchObject({
      status: 400,
      code: 'CHECK_VIOLATION',
    });
  });

  it("erreur inconnue → 500 sans détail (pas de fuite d'implémentation)", () => {
    const n = normalizeException(new Error('boom: password=xxx'));
    expect(n).toEqual({ status: 500, message: 'Erreur interne du serveur' });
  });

  it("un `code` non-SQLSTATE (ex. ENOTFOUND) n'est pas pris pour une erreur Postgres", () => {
    const err = Object.assign(new Error('dns'), { code: 'ENOTFOUND' });
    expect(pgErrorCode(err)).toBeUndefined();
  });
});
