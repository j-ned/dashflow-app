import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { STRIPE } from './stripe.constants';
import type { Env } from '../../config/env.schema';

@Global()
@Module({
  providers: [
    {
      provide: STRIPE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new Stripe(config.get('STRIPE_SECRET_KEY', { infer: true }) ?? 'sk_test_unconfigured'),
    },
  ],
  exports: [STRIPE],
})
export class StripeModule {}
