import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Mailer } from './mailer';
import type { Env } from '../config/env.schema';

@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('ConsoleMailer');

  constructor(private readonly config: ConfigService<Env, true>) {}

  sendVerificationCode(to: string, code: string): Promise<void> {
    this.logger.log(`[verification] ${to} → code ${code}`);
    return Promise.resolve();
  }

  sendAccountExists(to: string): Promise<void> {
    this.logger.log(`[account-exists] ${to}`);
    return Promise.resolve();
  }

  sendPasswordResetCode(to: string, code: string): Promise<void> {
    this.logger.log(`[reset] ${to} → code ${code}`);
    return Promise.resolve();
  }

  sendCalendarInvitation(
    to: string,
    senderName: string,
    calendarToken: string,
  ): Promise<void> {
    const url = `${this.config.get('APP_URL', { infer: true })}/medical/calendar/${calendarToken}`;
    this.logger.log(`[calendar-invite] ${to} (de ${senderName}) → ${url}`);
    return Promise.resolve();
  }
}
