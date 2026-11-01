import { Global, Module } from '@nestjs/common';
import { MAILER } from './mailer';
import { ConsoleMailer } from './console.mailer';
import { SmtpMailer } from './smtp.mailer';
import type { Env } from '../config/env.schema';
import { ENV } from '../config/env.token';

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ENV],
      useFactory: (config: Env) =>
        config.MAILER === 'smtp'
          ? new SmtpMailer(config)
          : new ConsoleMailer(config),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
