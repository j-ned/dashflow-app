import { describe, it, expect, vi } from 'vitest';
import { MembersService } from './members.service';
import { LimitExceededException } from '../entitlements/limit-exceeded.exception';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

// Faux DrizzleDB : `select().from().where()` renvoie le count agrégé ; `insert().values().returning()`
// renvoie la ligne projetée (MEMBER_PROJECTION). On vérifie l'ordre count → assertWithinLimit → insert.
function dbWithCount(currentCount: number, insertedRow: Record<string, unknown> = { id: 'new' }): DrizzleDB {
  return {
    select: () => ({ from: () => ({ where: async () => [{ value: currentCount }] }) }),
    insert: () => ({ values: () => ({ returning: async () => [insertedRow] }) }),
  } as unknown as DrizzleDB;
}

describe('MembersService.create — limite', () => {
  it('crée si sous la limite', async () => {
    const limits = { assertWithinLimit: vi.fn().mockResolvedValue(undefined) } as unknown as EntitlementLimitsService;
    const svc = new MembersService(dbWithCount(0), limits);
    const row = await svc.create('u1', { firstName: 'A' });
    expect(limits.assertWithinLimit).toHaveBeenCalledWith('u1', 'members', 0);
    expect(row).toEqual({ id: 'new' });
  });

  it('propage le 402 si la limite est atteinte (insert non appelé)', async () => {
    const insert = vi.fn(() => ({ values: () => ({ returning: async () => [{ id: 'new' }] }) }));
    const db = {
      select: () => ({ from: () => ({ where: async () => [{ value: 1 }] }) }),
      insert,
    } as unknown as DrizzleDB;
    const limits = {
      assertWithinLimit: vi.fn().mockRejectedValue(new LimitExceededException('members', 1)),
    } as unknown as EntitlementLimitsService;
    const svc = new MembersService(db, limits);
    await expect(svc.create('u1', { firstName: 'B' })).rejects.toBeInstanceOf(LimitExceededException);
    expect(insert).not.toHaveBeenCalled();
  });
});
