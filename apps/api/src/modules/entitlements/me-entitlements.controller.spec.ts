import { describe, it, expect } from 'vitest';
import { MeEntitlementsController } from './me-entitlements.controller';
import type { EntitlementService } from './entitlement.service';
import type { ResolvedEntitlement } from './entitlement.resolver';

describe('MeEntitlementsController', () => {
  it('retourne l’entitlement résolu de l’utilisateur courant', async () => {
    const expected: ResolvedEntitlement = {
      planKey: 'family',
      features: ['budget.core'],
      limits: { bankAccounts: null, members: null, storageBytes: 0 },
    };
    let receivedUserId = '';
    const svc = {
      getForUser: async (userId: string) => {
        receivedUserId = userId;
        return expected;
      },
    } as unknown as EntitlementService;

    const controller = new MeEntitlementsController(svc);
    const result = await controller.me({ id: 'user-42', email: 'a@b.com' });

    expect(receivedUserId).toBe('user-42');
    expect(result).toEqual(expected);
  });
});
