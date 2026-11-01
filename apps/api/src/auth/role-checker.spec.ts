import { describe, it, expect } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '../common/errors';
import type { DrizzleDB } from '../db/drizzle.constants';
import { RoleChecker } from './role-checker';

const db = (role: string | null): DrizzleDB =>
  ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => (role ? [{ role }] : []) }),
      }),
    }),
  }) as unknown as DrizzleDB;

describe('RoleChecker', () => {
  it('laisse passer si aucun rôle requis', async () => {
    await expect(new RoleChecker(db('user')).assert('u1', [])).resolves.toBe(
      undefined,
    );
  });
  it('laisse passer un admin', async () => {
    await expect(
      new RoleChecker(db('admin')).assert('u1', ['admin']),
    ).resolves.toBe(undefined);
  });
  it('refuse (403) un user non admin', async () => {
    await expect(
      new RoleChecker(db('user')).assert('u1', ['admin']),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
  it('refuse (401) sans utilisateur', async () => {
    await expect(
      new RoleChecker(db('admin')).assert(undefined, ['admin']),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
