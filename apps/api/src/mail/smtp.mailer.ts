import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Mailer } from './mailer';
import type { Env } from '../config/env.schema';

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

@Injectable()
export class SmtpMailer implements Mailer {
  private readonly logger = new Logger('SmtpMailer');
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly appUrl: string;

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
    this.appUrl = config.get('APP_URL', { infer: true });
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

  async sendCalendarInvitation(to: string, senderName: string, calendarToken: string): Promise<void> {
    const calendarUrl = `${this.appUrl}/api/medical/calendar/${calendarToken}`;
    const webcalUrl = calendarUrl.replace(/^https?:\/\//, 'webcal://');
    const googleCalUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `${senderName} partage son calendrier médical avec vous - DashFlow`,
      text: `${senderName} vous invite à suivre son calendrier médical DashFlow.\n\nLien d'abonnement : ${webcalUrl}\nGoogle Calendar : ${googleCalUrl}\nApple / Outlook / Thunderbird : ${calendarUrl}`,
      html: shell(
        'Invitation calendrier médical',
        `<div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;"><strong>${senderName}</strong> vous invite à suivre son calendrier médical</p>
          <a href="${googleCalUrl}" style="display: inline-block; background: #4285f4; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Ajouter à Google Calendar</a><br/>
          <a href="${webcalUrl}" style="display: inline-block; background: #1a1a2e; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 8px;">S'abonner (Apple / Outlook / Thunderbird)</a>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">Ou copiez ce lien dans votre calendrier :</p>
          <p style="font-family: monospace; font-size: 11px; color: #374151; word-break: break-all; margin: 0; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">${calendarUrl}</p>
        </div>`,
      ),
    });
  }
}
