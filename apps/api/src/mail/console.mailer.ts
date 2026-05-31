import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Mailer } from './mailer';
import type { Env } from '../config/env.schema';

@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('ConsoleMailer');

  constructor(private readonly config: ConfigService<Env, true>) {}

  async sendVerificationCode(to: string, code: string): Promise<void> {
    this.logger.log(`[verification] ${to} → code ${code}`);
    console.log(`[verification] ${to} → code ${code}`);
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    this.logger.log(`[reset] ${to} → code ${code}`);
    console.log(`[reset] ${to} → code ${code}`);
  }

  async sendCalendarInvitation(to: string, senderName: string, calendarToken: string): Promise<void> {
    const url = `${this.config.get('APP_URL', { infer: true })}/api/medical/calendar/${calendarToken}`;
    this.logger.log(`[calendar-invite] ${to} (de ${senderName}) → ${url}`);
    console.log(`[calendar-invite] ${to} → ${url}`);
  }
}
