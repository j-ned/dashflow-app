import type { NoticeReason } from '../modules/admin/account-security';

export const MAILER = Symbol('MAILER');

export interface Mailer {
  sendVerificationCode(to: string, code: string): Promise<void>;
  sendPasswordResetCode(to: string, code: string): Promise<void>;
  sendAccountExists(email: string): Promise<void>;
  /** Relance de sécurité déclenchée par un administrateur. Texte fixe par motif : pas de contenu libre. */
  sendSecurityNotice(to: string, reason: NoticeReason): Promise<void>;
}
