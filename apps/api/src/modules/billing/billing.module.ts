import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeEventsRepository } from './stripe-events.repository';

@Module({
  imports: [AuthModule],
  controllers: [BillingController],
  providers: [BillingService, StripeEventsRepository],
})
export class BillingModule {}
