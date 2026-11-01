import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError } from './errors';
import {
  errorResponseBody,
  normalizeError,
  pgErrorCode,
  statusName,
} from './error-response';

describe('error-response : normalisation', () => {
  it('AppError : statut, message, code et details passent', () => {
    const n = normalizeError(
      new AppError(409, 'Données médicales liées', 'MEMBER_HAS_MEDICAL_DATA', {
        appointments: 2,
      }),
    );
    expect(n).toEqual({
      status: 409,
      message: 'Données médicales liées',
      code: 'MEMBER_HAS_MEDICAL_DATA',
      details: { appointments: 2 },
    });
  });

  it('statusName et errorResponseBody : nom du statut, code/details seulement si présents', () => {
    expect(statusName(404)).toBe('NOT_FOUND');
    expect(statusName(418)).toBe('ERROR');

    const plain = errorResponseBody(
      normalizeError(new NotFoundError('Non trouvé')),
      '/x',
    );
    expect(plain).toEqual({
      statusCode: 404,
      error: 'NOT_FOUND',
      message: 'Non trouvé',
      path: '/x',
      timestamp: expect.any(String),
    });
    expect(plain).not.toHaveProperty('code');
    expect(plain).not.toHaveProperty('details');

    const rich = errorResponseBody(
      { status: 409, message: 'm', code: 'C', details: { n: 1 } },
      '/y',
    );
    expect(rich).toMatchObject({
      statusCode: 409,
      error: 'CONFLICT',
      code: 'C',
      details: { n: 1 },
      path: '/y',
    });
    expect(Number.isNaN(Date.parse(rich.timestamp))).toBe(false);
  });

  it('erreur Postgres nue (postgres-js) : 23505 → 409 UNIQUE_VIOLATION', () => {
    const err = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(normalizeError(err)).toMatchObject({
      status: 409,
      code: 'UNIQUE_VIOLATION',
    });
  });

  it('erreur Postgres enveloppée par drizzle (cause) : 23514 → 400 CHECK_VIOLATION', () => {
    const wrapped = new Error('Failed query', {
      cause: Object.assign(new Error('check'), { code: '23514' }),
    });
    expect(pgErrorCode(wrapped)).toBe('23514');
    expect(normalizeError(wrapped)).toMatchObject({
      status: 400,
      code: 'CHECK_VIOLATION',
    });
  });

  it("erreur inconnue → 500 sans détail (pas de fuite d'implémentation)", () => {
    const n = normalizeError(new Error('boom: password=xxx'));
    expect(n).toEqual({ status: 500, message: 'Erreur interne du serveur' });
  });

  it("un `code` non-SQLSTATE (ex. ENOTFOUND) n'est pas pris pour une erreur Postgres", () => {
    const err = Object.assign(new Error('dns'), { code: 'ENOTFOUND' });
    expect(pgErrorCode(err)).toBeUndefined();
  });
});
