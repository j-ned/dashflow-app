import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { MeEntitlementsController } from './me-entitlements.controller';
import { EntitlementService } from './entitlement.service';
import { SubscriptionRepository } from './subscription.repository';
import { FeatureGuard } from './feature.guard';
import { EntitlementLimitsService } from './entitlement-limits.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [MeEntitlementsController],
  providers: [EntitlementService, SubscriptionRepository, FeatureGuard, EntitlementLimitsService],
  exports: [EntitlementService, FeatureGuard, EntitlementLimitsService, SubscriptionRepository],
})
export class EntitlementsModule {}
