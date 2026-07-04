import { describe, it, expect } from 'vitest';
import {
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import type { DrizzleDB } from '../../db/drizzle.constants';

function ctx(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}
const reflector = (roles: string[] | undefined): Reflector =>
  ({ getAllAndOverride: () => roles }) as unknown as Reflector;
const db = (role: string | null): DrizzleDB =>
  ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => (role ? [{ role }] : []) }),
      }),
    }),
  }) as unknown as DrizzleDB;

describe('RolesGuard', () => {
  it('laisse passer si aucun rôle requis', async () => {
    const guard = new RolesGuard(reflector(undefined), db('user'));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });
  it('laisse passer un admin', async () => {
    const guard = new RolesGuard(reflector(['admin']), db('admin'));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).resolves.toBe(true);
  });
  it('refuse (403) un user non admin', async () => {
    const guard = new RolesGuard(reflector(['admin']), db('user'));
    await expect(guard.canActivate(ctx({ id: 'u1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('refuse (401) sans utilisateur', async () => {
    const guard = new RolesGuard(reflector(['admin']), db('admin'));
    await expect(guard.canActivate(ctx(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
