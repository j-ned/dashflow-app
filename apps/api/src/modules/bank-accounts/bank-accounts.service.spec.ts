import { describe, it, expect, vi } from 'vitest';
import { BankAccountsService } from './bank-accounts.service';
import { LimitExceededException } from '../entitlements/limit-exceeded.exception';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { EntitlementLimitsService } from '../entitlements/entitlement-limits.service';

// db factice : select().from().where() → [{ value: <count> }] ; insert().values().returning() → [row]
function dbWithCount(currentCount: number): DrizzleDB {
  return {
    select: () => ({ from: () => ({ where: async () => [{ value: currentCount }] }) }),
    insert: () => ({ values: () => ({ returning: async () => [{ id: 'new' }] }) }),
  } as unknown as DrizzleDB;
}

describe('BankAccountsService.create — limite', () => {
  it('crée si sous la limite', async () => {
    const limits = { assertWithinLimit: vi.fn().mockResolvedValue(undefined) } as unknown as EntitlementLimitsService;
    const svc = new BankAccountsService(dbWithCount(0), limits);
    const row = await svc.create('u1', { name: 'A' });
    expect(limits.assertWithinLimit).toHaveBeenCalledWith('u1', 'bankAccounts', 0);
    expect(row).toEqual({ id: 'new' });
  });

  it('propage le 402 si la limite est atteinte', async () => {
    const limits = {
      assertWithinLimit: vi.fn().mockRejectedValue(new LimitExceededException('bankAccounts', 1)),
    } as unknown as EntitlementLimitsService;
    const svc = new BankAccountsService(dbWithCount(1), limits);
    await expect(svc.create('u1', { name: 'B' })).rejects.toBeInstanceOf(LimitExceededException);
  });
});
