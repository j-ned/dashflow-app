import { Injectable } from '@nestjs/common';
import { EntitlementService } from './entitlement.service';
import { LimitExceededException, type LimitKey } from './limit-exceeded.exception';

@Injectable()
export class EntitlementLimitsService {
  constructor(private readonly entitlements: EntitlementService) {}

  /** Lève 402 `LIMIT_REACHED` si `currentCount` atteint déjà la limite du plan. `null` = illimité. */
  async assertWithinLimit(userId: string, limit: LimitKey, currentCount: number): Promise<void> {
    const entitlement = await this.entitlements.getForUser(userId);
    const max = entitlement.limits[limit];
    if (max !== null && currentCount >= max) {
      throw new LimitExceededException(limit, max);
    }
  }
}
