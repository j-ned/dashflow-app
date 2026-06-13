import { Global, Module } from '@nestjs/common';
import { MeEntitlementsController } from './me-entitlements.controller';
import { EntitlementService } from './entitlement.service';
import { SubscriptionRepository } from './subscription.repository';
import { FeatureGuard } from './feature.guard';
import { EntitlementLimitsService } from './entitlement-limits.service';

@Global()
@Module({
  controllers: [MeEntitlementsController],
  providers: [EntitlementService, SubscriptionRepository, FeatureGuard, EntitlementLimitsService],
  exports: [EntitlementService, FeatureGuard, EntitlementLimitsService],
})
export class EntitlementsModule {}
