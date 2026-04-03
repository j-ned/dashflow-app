import { createTransport } from 'nodemailer';

const transporter = createTransport({
  host: process.env['SMTP_HOST'],
  port: Number(process.env['SMTP_PORT'] ?? 587),
  secure: process.env['SMTP_SECURE'] === 'true',
  auth: {
    user: process.env['SMTP_USER'],
    pass: process.env['SMTP_PASS'],
  },
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

const FROM = process.env['SMTP_FROM'] ?? 'DashFlow <noreply@example.com>';

export async function sendVerificationCode(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Votre code de verification - DashFlow',
    text: `Votre code de verification est : ${code}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demande ce code, ignorez cet email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 8px;">DashFlow</h2>
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 32px;">Verification de votre adresse email</p>
        <div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">Votre code de verification</p>
          <p style="font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a2e; margin: 0;">${code}</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Ce code expire dans 10 minutes.<br/>Si vous n'avez pas demande ce code, ignorez cet email.</p>
      </div>
    `,
  });
}

export async function sendMedicationAlert(to: string): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Alerte medicament - DashFlow',
    text: `Un de vos medicaments arrive bientot a epuisement.\n\nConnectez-vous a DashFlow pour voir les details et renouveler l'ordonnance.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 8px;">DashFlow</h2>
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 32px;">Alerte stock medicament</p>
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">Un medicament arrive bientot a epuisement</p>
          <p style="color: #374151; font-size: 14px; margin: 0;">Connectez-vous a DashFlow pour voir les details.</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Pensez a renouveler l'ordonnance aupres de votre medecin.</p>
      </div>
    `,
  });
}

export async function sendPasswordResetCode(to: string, code: string): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Reinitialisation de mot de passe - DashFlow',
    text: `Votre code de reinitialisation est : ${code}\n\nCe code expire dans 10 minutes.\n\nSi vous n'avez pas demande cette reinitialisation, ignorez cet email.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 8px;">DashFlow</h2>
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 32px;">Reinitialisation de votre mot de passe</p>
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">Votre code de reinitialisation</p>
          <p style="font-family: monospace; font-size: 32px; letter-spacing: 8px; font-weight: bold; color: #1a1a2e; margin: 0;">${code}</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Ce code expire dans 10 minutes.<br/>Si vous n'avez pas demande cette reinitialisation, ignorez cet email.</p>
      </div>
    `,
  });
}

export async function sendCalendarInvitation(to: string, senderName: string, calendarToken: string): Promise<void> {
  const appUrl = process.env['APP_URL'] ?? 'http://localhost:3000';
  const calendarUrl = `${appUrl}/api/medical/calendar/${calendarToken}`;
  const webcalUrl = calendarUrl.replace(/^https?:\/\//, 'webcal://');
  const googleCalUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: `${senderName} partage son calendrier medical avec vous - DashFlow`,
    text: `${senderName} vous invite a suivre son calendrier medical DashFlow.\n\nVous pourrez voir ses rendez-vous medicaux et alertes de medicaments directement dans votre application de calendrier.\n\nLien d'abonnement : ${webcalUrl}\n\nGoogle Calendar : ${googleCalUrl}\n\nPour Apple Calendar / Thunderbird / Outlook : copiez ce lien dans votre application de calendrier : ${calendarUrl}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 8px;">DashFlow</h2>
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 32px;">Invitation calendrier medical</p>
        <div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 16px 0;"><strong>${senderName}</strong> vous invite a suivre son calendrier medical</p>
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 20px 0;">Rendez-vous, ordonnances et alertes medicaments — tout dans votre calendrier habituel.</p>
          <a href="${googleCalUrl}" style="display: inline-block; background: #4285f4; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-bottom: 12px;">Ajouter a Google Calendar</a>
          <br/>
          <a href="${webcalUrl}" style="display: inline-block; background: #1a1a2e; color: #fff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 14px; font-weight: 600; margin-top: 8px;">S'abonner (Apple / Outlook / Thunderbird)</a>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0 0 8px 0;">Ou copiez ce lien dans votre application de calendrier :</p>
          <p style="font-family: monospace; font-size: 11px; color: #374151; word-break: break-all; margin: 0; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e5e7eb;">${calendarUrl}</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">Ce calendrier se synchronise automatiquement.<br/>Si vous ne connaissez pas ${senderName}, ignorez cet email.</p>
      </div>
    `,
  });
}

export async function sendAppointmentReminder(to: string): Promise<void> {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Rappel rendez-vous medical - DashFlow',
    text: `Vous avez un rendez-vous medical a venir.\n\nConnectez-vous a DashFlow pour voir les details.`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="text-align: center; color: #1a1a2e; margin-bottom: 8px;">DashFlow</h2>
        <p style="text-align: center; color: #6b7280; font-size: 14px; margin-bottom: 32px;">Rappel de rendez-vous medical</p>
        <div style="background: #f0f4ff; border: 1px solid #dbeafe; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
          <p style="color: #374151; font-size: 14px; margin: 0 0 12px 0;">Vous avez un rendez-vous medical a venir</p>
          <p style="color: #374151; font-size: 14px; margin: 0;">Connectez-vous a DashFlow pour voir les details.</p>
        </div>
        <p style="color: #9ca3af; font-size: 12px; text-align: center;">N'oubliez pas de vous y rendre.</p>
      </div>
    `,
  });
}
