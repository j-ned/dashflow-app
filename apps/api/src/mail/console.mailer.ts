import { Injectable, Logger } from '@nestjs/common';
import type { Mailer } from './mailer';

@Injectable()
export class ConsoleMailer implements Mailer {
  private readonly logger = new Logger('ConsoleMailer');
  async sendVerificationCode(to: string, code: string): Promise<void> {
    this.logger.log(`[verification] ${to} → code ${code}`);
    console.log(`[verification] ${to} → code ${code}`);
  }
  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    this.logger.log(`[reset] ${to} → code ${code}`);
    console.log(`[reset] ${to} → code ${code}`);
  }
}
