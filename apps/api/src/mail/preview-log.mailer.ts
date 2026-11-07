import type { Mailer } from './mailer';
import type { NoticeReason } from '../modules/admin/account-security';
import { SECURITY_NOTICE_CONTENT } from './security-notice.content';
import { MAIL_SUBJECTS } from './subjects';
import { createLogger } from '../common/logger';

/** `julien@example.com` → `j***@example.com` : assez pour reconnaître le compte de démo. */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  return at < 1 ? '***' : `${email[0]}***${email.slice(at)}`;
}

/**
 * Preview Vercel : aucun envoi. Les logs d'une preview sont lisibles par toute l'équipe Vercel et
 * conservés : ni code OTP, ni lien, ni adresse complète n'y sont écrits.
 */
export class PreviewLogMailer implements Mailer {
  private readonly logger = createLogger('PreviewLogMailer');

  private skip(to: string, subject: string): Promise<void> {
    this.logger.log(
      `Email non envoyé (preview) : ${maskEmail(to)} — ${subject}`,
    );
    return Promise.resolve();
  }

  sendVerificationCode(to: string): Promise<void> {
    return this.skip(to, MAIL_SUBJECTS.verification);
  }

  sendPasswordResetCode(to: string): Promise<void> {
    return this.skip(to, MAIL_SUBJECTS.passwordReset);
  }

  sendAccountExists(to: string): Promise<void> {
    return this.skip(to, MAIL_SUBJECTS.accountExists);
  }

  sendSecurityNotice(to: string, reason: NoticeReason): Promise<void> {
    return this.skip(to, SECURITY_NOTICE_CONTENT[reason].subject);
  }
}
