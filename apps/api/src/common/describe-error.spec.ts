import { describe, it, expect } from 'vitest';
import { DrizzleQueryError } from 'drizzle-orm';
import { describeError, errorStack } from './describe-error';

const SECRET_PARAMS = ['patient.secret@example.test', 'Diabète type 1'];

/** Erreur telle que Drizzle la lève : la requête paramétrée, ses valeurs, et la cause Postgres. */
const failedQuery = () =>
  new DrizzleQueryError(
    'insert into "patients" ("email", "notes") values ($1, $2)',
    SECRET_PARAMS,
    new Error('canceling statement due to statement timeout'),
  );

describe('describeError', () => {
  it('requête SQL en échec : la cause et la requête, jamais les valeurs liées', () => {
    const text = describeError(failedQuery());

    expect(text).toContain('canceling statement due to statement timeout');
    expect(text).toContain('insert into "patients"');
    for (const value of SECRET_PARAMS) expect(text).not.toContain(value);
  });

  it('autre erreur : son message, tel quel', () => {
    expect(describeError(new Error('Redis injoignable'))).toBe(
      'Redis injoignable',
    );
    expect(describeError('texte brut')).toBe('texte brut');
  });
});

describe('errorStack', () => {
  it('requête SQL en échec : la pile d’appels sans les valeurs liées', () => {
    const stack = errorStack(failedQuery());

    expect(stack).toMatch(/\n\s+at /);
    for (const value of SECRET_PARAMS) expect(stack).not.toContain(value);
  });
});
