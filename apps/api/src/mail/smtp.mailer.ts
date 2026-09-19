import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Mailer } from './mailer';
import type { Env } from '../config/env.schema';
import type { NoticeReason } from '../modules/admin/account-security';
import {
  SECURITY_NOTICE_CONTENT,
  SECURITY_NOTICE_FOOTER,
  securityNoticeText,
} from './security-notice.content';

const shell = (subtitle: string, inner: string): string => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
    <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 8px;">DashFlow</h2>
    <p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 32px;">${subtitle}</p>
    ${inner}
  </div>`;

const codeCard = (label: string, code: string): string => `
  <div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
    <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">${label}</p>
    <p style="font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a2e; margin: 0;">${code}</p>
  </div>`;

/** `CORS_ORIGIN` peut lister plusieurs origines séparées par des virgules : le site est la première. */
export const webUrlFrom = (corsOrigin: string): string =>
  corsOrigin.split(',')[0].trim().replace(/\/+$/, '');

@Injectable()
export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;
  private readonly from: string;
  /** Adresse du site (pas de l'API) : c'est là que mènent les liens des mails. */
  private readonly webUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.transporter = createTransport({
      host: config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      auth: {
        user: config.get('SMTP_USER', { infer: true }),
        pass: config.get('SMTP_PASS', { infer: true }),
      },
      connectionTimeout: 30_000,
      greetingTimeout: 30_000,
      socketTimeout: 45_000,
    });
    this.from = config.get('SMTP_FROM', { infer: true });
    // APP_URL est l'adresse de l'API (callback OAuth). Le site est la première origine CORS.
    this.webUrl = webUrlFrom(config.get('CORS_ORIGIN', { infer: true }));
  }

  async sendVerificationCode(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Votre code de vérification - DashFlow',
      text: `Votre code de vérification est : ${code}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez cet email.`,
      html: shell(
        'Vérification de votre adresse email',
        codeCard('Votre code de vérification', code) +
          `<p style="color: #9ca3af; font-size: 12px; text-align: center;">Ce code expire dans 10 minutes.<br/>Si vous n'avez pas demandé ce code, ignorez cet email.</p>`,
      ),
    });
  }

  async sendAccountExists(to: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Vous avez déjà un compte DashFlow',
      text: `Un compte DashFlow existe déjà pour cette adresse.\n\nConnectez-vous : ${this.webUrl}/auth/login\nMot de passe oublié : ${this.webUrl}/auth/forgot-password`,
      html: shell(
        'Vous avez déjà un compte DashFlow',
        `<div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;">Un compte existe déjà pour cette adresse. Si vous avez oublié votre mot de passe, vous pouvez le réinitialiser.</p>
          <a href="${this.webUrl}/auth/login" style="display: inline-block; background: #1a1a2e; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Se connecter</a><br/>
          <a href="${this.webUrl}/auth/forgot-password" style="display: inline-block; color: #6b7280; text-decoration: underline; font-size: 13px; margin-top: 8px;">Mot de passe oublié ?</a>
        </div>`,
      ),
    });
  }

  async sendSecurityNotice(to: string, reason: NoticeReason): Promise<void> {
    const content = SECURITY_NOTICE_CONTENT[reason];
    const steps = content.steps
      .map(
        (step) =>
          `<li style="color: #374151; font-size: 14px; line-height: 1.5; margin-bottom: 8px;">${step}</li>`,
      )
      .join('');
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: content.subject,
      text: securityNoticeText(content, this.webUrl),
      html: shell(
        'Sécurité de votre compte',
        `<div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; line-height: 1.5; margin: 0 0 16px 0;">${content.intro}</p>
          <ol style="padding-left: 20px; margin: 0 0 20px 0;">${steps}</ol>
          <p style="text-align: center; margin: 0;"><a href="${this.webUrl}${content.cta.path}" style="display: inline-block; background: #1a1a2e; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600;">${content.cta.label}</a></p>
        </div>
        <p style="color: #6b7280; font-size: 12px; line-height: 1.5; text-align: center;">${SECURITY_NOTICE_FOOTER}</p>`,
      ),
    });
  }

  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Réinitialisation de mot de passe - DashFlow',
      text: `Votre code de réinitialisation est : ${code}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.`,
      html: shell(
        'Réinitialisation de votre mot de passe',
        codeCard('Votre code de réinitialisation', code) +
          `<p style="color: #9ca3af; font-size: 12px; text-align: center;">Ce code expire dans 10 minutes.<br/>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>`,
      ),
    });
  }
}
