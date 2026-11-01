import type { Mailer } from './mailer';
import type { Env } from '../config/env.schema';
import type { NoticeReason } from '../modules/admin/account-security';
import { createLogger } from '../common/logger';

export class ConsoleMailer implements Mailer {
  private readonly logger = createLogger('ConsoleMailer');

  constructor(private readonly config: Env) {}

  sendVerificationCode(to: string, code: string): Promise<void> {
    this.logger.log(`[verification] ${to} → code ${code}`);
    return Promise.resolve();
  }

  sendAccountExists(to: string): Promise<void> {
    this.logger.log(`[account-exists] ${to}`);
    return Promise.resolve();
  }

  sendSecurityNotice(to: string, reason: NoticeReason): Promise<void> {
    this.logger.log(`[security-notice] ${to} → ${reason}`);
    return Promise.resolve();
  }

  sendPasswordResetCode(to: string, code: string): Promise<void> {
    this.logger.log(`[reset] ${to} → code ${code}`);
    return Promise.resolve();
  }
}
