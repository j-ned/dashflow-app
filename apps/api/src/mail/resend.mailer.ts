import type { Mailer } from './mailer';
import type { NoticeReason } from '../modules/admin/account-security';
import {
  accountExistsMessage,
  passwordResetMessage,
  securityNoticeMessage,
  verificationMessage,
  webUrlFrom,
  type MailMessage,
} from './messages';

const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
/** Au-delà, l'envoi échoue plutôt que de bloquer la requête de l'utilisateur. */
const RESEND_TIMEOUT_MS = 15_000;

export type ResendConfig = {
  readonly RESEND_API_KEY: string;
  /** Expéditeur, sur un domaine vérifié chez Resend : `DashFlow <noreply@domaine>`. */
  readonly MAIL_FROM: string;
  readonly CORS_ORIGIN: string;
};

/**
 * Envoi par l'API HTTP de Resend : pas de connexion SMTP à ouvrir. Un refus ou une panne fait
 * échouer l'envoi, comme le transport SMTP. Le message d'erreur garde le statut, jamais le
 * destinataire ni le contenu (un code de vérification y figure).
 */
export class ResendMailer implements Mailer {
  /** Adresse du site (pas de l'API) : c'est là que mènent les liens des mails. */
  private readonly webUrl: string;

  constructor(
    private readonly config: ResendConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {
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
    let response: Response;
    try {
      response = await this.fetchFn(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.config.MAIL_FROM, to, ...message }),
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(`Resend injoignable — ${message.subject}`, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new Error(
        `Envoi refusé par Resend (${response.status}) — ${message.subject}`,
      );
    }
  }
}
