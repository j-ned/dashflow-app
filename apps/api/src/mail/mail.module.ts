import { Global, Module } from '@nestjs/common';
import { MAILER } from './mailer';
import { ConsoleMailer } from './console.mailer';

@Global()
@Module({
  providers: [{ provide: MAILER, useClass: ConsoleMailer }],
  exports: [MAILER],
})
export class MailModule {}
