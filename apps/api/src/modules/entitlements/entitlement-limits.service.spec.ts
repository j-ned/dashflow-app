import { describe, it, expect } from 'vitest';
import { EntitlementLimitsService } from './entitlement-limits.service';
import { LimitExceededException } from './limit-exceeded.exception';
import type { EntitlementService } from './entitlement.service';
import type { PlanLimits } from './plan-catalog';

function svcWith(limits: PlanLimits): EntitlementLimitsService {
  const entitlements = {
    getForUser: async () => ({ planKey: 'solo', features: [], limits }),
  } as unknown as EntitlementService;
  return new EntitlementLimitsService(entitlements);
}

describe('EntitlementLimitsService.assertWithinLimit', () => {
  it('laisse passer sous la limite', async () => {
    const svc = svcWith({ bankAccounts: 1, members: 1, storageBytes: 0 });
    await expect(svc.assertWithinLimit('u1', 'bankAccounts', 0)).resolves.toBeUndefined();
  });

  it('refuse (402) quand le compte courant atteint la limite', async () => {
    const svc = svcWith({ bankAccounts: 1, members: 1, storageBytes: 0 });
    await expect(svc.assertWithinLimit('u1', 'bankAccounts', 1)).rejects.toBeInstanceOf(LimitExceededException);
  });

  it('limite null = illimité, laisse toujours passer', async () => {
    const svc = svcWith({ bankAccounts: null, members: null, storageBytes: 0 });
    await expect(svc.assertWithinLimit('u1', 'members', 9999)).resolves.toBeUndefined();
  });
});
