import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '../common/errors';
import { assertNotDemo } from './demo-restriction';

describe('assertNotDemo', () => {
  it('given session démo (isDemo: true), then 403', () => {
    expect(() =>
      assertNotDemo({
        id: 'demo',
        email: 'd@x.io',
        sessionVersion: 0,
        isDemo: true,
      }),
    ).toThrow(ForbiddenError);
  });

  it('given session normale (isDemo: false), then passe', () => {
    expect(() =>
      assertNotDemo({
        id: 'u1',
        email: 'a@b.com',
        sessionVersion: 0,
        isDemo: false,
      }),
    ).not.toThrow();
  });

  it('given user sans isDemo (ancien JWT sans claim), then passe', () => {
    expect(() =>
      assertNotDemo({ id: 'u1', email: 'a@b.com', sessionVersion: 0 }),
    ).not.toThrow();
  });

  it("given aucun user (middleware mal ordonné), then passe : l'authentification reste responsable du 401", () => {
    expect(() => assertNotDemo(undefined)).not.toThrow();
  });
});
