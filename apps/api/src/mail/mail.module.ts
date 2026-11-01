import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAILER } from './mailer';
import { ConsoleMailer } from './console.mailer';
import { SmtpMailer } from './smtp.mailer';
import type { Env } from '../config/env.schema';

@Global()
@Module({
  providers: [
    {
      provide: MAILER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('MAILER', { infer: true }) === 'smtp'
          ? new SmtpMailer(config)
          : new ConsoleMailer(config),
    },
  ],
  exports: [MAILER],
})
export class MailModule {}
