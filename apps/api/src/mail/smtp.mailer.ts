import { createTransport, type Transporter } from 'nodemailer';
import type { Mailer } from './mailer';
import type { Env } from '../config/env.schema';
import type { NoticeReason } from '../modules/admin/account-security';
import {
  accountExistsMessage,
  passwordResetMessage,
  securityNoticeMessage,
  verificationMessage,
  webUrlFrom,
  type MailMessage,
} from './messages';

export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;
  private readonly from: string;
  /** Adresse du site (pas de l'API) : c'est là que mènent les liens des mails. */
  private readonly webUrl: string;

  constructor(
    config: Pick<
      Env,
      | 'CORS_ORIGIN'
      | 'SMTP_FROM'
      | 'SMTP_HOST'
      | 'SMTP_PASS'
      | 'SMTP_PORT'
      | 'SMTP_SECURE'
      | 'SMTP_USER'
    >,
  ) {
    this.transporter = createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 45_000,
    });
    this.from = config.SMTP_FROM;
    // APP_URL est l'adresse de l'API (callback OAuth). Le site est la première origine CORS.
    this.webUrl = webUrlFrom(config.CORS_ORIGIN);
  }

  sendVerificationCode(to: string, code: string): Promise<void> {
    return this.send(to, verificationMessage(code));
  }

  sendAccountExists(to: string): Promise<void> {
    return this.send(to, accountExistsMessage(this.webUrl));
  }

  sendSecurityNotice(to: string, reason: NoticeReason): Promise<void> {
    return this.send(to, securityNoticeMessage(reason, this.webUrl));
  }

  sendPasswordResetCode(to: string, code: string): Promise<void> {
    return this.send(to, passwordResetMessage(code));
  }

  private async send(to: string, message: MailMessage): Promise<void> {
    await this.transporter.sendMail({ from: this.from, to, ...message });
  }
}
