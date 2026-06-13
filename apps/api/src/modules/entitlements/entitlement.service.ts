import { Injectable } from '@nestjs/common';
import { SubscriptionRepository, type SubscriptionRow } from './subscription.repository';
import {
  resolveEntitlement,
  type ResolvedEntitlement,
  type SubscriptionSnapshot,
  type SubscriptionStatus,
  type EntitlementSource,
} from './entitlement.resolver';
import type { PlanKey } from './plan-catalog';

function toSnapshot(row: SubscriptionRow | null): SubscriptionSnapshot | null {
  if (!row) return null;
  return {
    planKey: row.planKey as PlanKey,
    status: row.status as SubscriptionStatus,
    source: row.source as EntitlementSource,
    currentPeriodEnd: row.currentPeriodEnd,
  };
}

@Injectable()
export class EntitlementService {
  constructor(private readonly subscriptions: SubscriptionRepository) {}

  async getForUser(userId: string): Promise<ResolvedEntitlement> {
    const row = await this.subscriptions.findByUserId(userId);
    return resolveEntitlement(toSnapshot(row), new Date());
  }
}
