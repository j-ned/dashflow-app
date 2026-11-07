import { afterEach, describe, it, expect, vi } from 'vitest';
import { maskEmail, PreviewLogMailer } from './preview-log.mailer';
import { createMailer } from './create-mailer';
import { ConsoleMailer } from './console.mailer';
import { SmtpMailer } from './smtp.mailer';
import { envSchema } from '../config/env.schema';
import type { Mailer } from './mailer';

const CODE = '482913';
const TO = 'julien.secret@example.com';

/** Tout ce qui sort sur la console pendant `run`, toutes méthodes confondues. */
async function captureConsole(run: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const record = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation(record);
  await run();
  return lines;
}

const sendAll = async (m: Mailer) => {
  await m.sendVerificationCode(TO, CODE);
  await m.sendPasswordResetCode(TO, CODE);
  await m.sendAccountExists(TO);
  await m.sendSecurityNotice(TO, 'reconnect');
};

afterEach(() => vi.restoreAllMocks());

describe('maskEmail', () => {
  it.each([
    ['julien.secret@example.com', 'j***@example.com'],
    ['a@b.co', 'a***@b.co'],
    ['pas-une-adresse', '***'],
    ['@example.com', '***'],
  ])('%s → %s', (email, masked) => {
    expect(maskEmail(email)).toBe(masked);
  });
});

describe('PreviewLogMailer', () => {
  it('une ligne par email : destinataire masqué et sujet, jamais le code, l’adresse ni un lien', async () => {
    const lines = await captureConsole(() => sendAll(new PreviewLogMailer()));
    expect(lines).toHaveLength(4);
    for (const line of lines) {
      expect(line).toContain('j***@example.com');
      expect(line).not.toContain(CODE);
      expect(line).not.toContain('julien.secret');
      expect(line).not.toMatch(/https?:\/\//);
    }
    expect(lines[0]).toContain('Votre code de vérification - DashFlow');
    expect(lines[1]).toContain('Réinitialisation de mot de passe - DashFlow');
    expect(lines[2]).toContain('Vous avez déjà un compte DashFlow');
    expect(lines[3]).toContain('Reconnectez-vous');
  });
});

describe('createMailer', () => {
  const base = {
    DATABASE_URL: 'postgres://u:p@db:5432/d',
    JWT_SECRET: 'P' + 'r3view-secret-'.repeat(3),
  };
  const env = (extra: Record<string, string>) =>
    envSchema.parse({ ...base, ...extra });

  it('preview : aucun envoi réel, même avec MAILER=smtp et un SMTP configuré', () => {
    expect(
      createMailer(
        env({
          VERCEL_ENV: 'preview',
          NODE_ENV: 'production',
          MAILER: 'smtp',
          SMTP_HOST: 'mail.example.org',
        }),
      ),
    ).toBeInstanceOf(PreviewLogMailer);
  });

  it('preview avec MAILER=console (défaut) : aucun code OTP dans les logs', async () => {
    const mailer = createMailer(env({ VERCEL_ENV: 'preview' }));
    const lines = await captureConsole(() =>
      mailer.sendVerificationCode(TO, CODE),
    );
    expect(lines.join('\n')).not.toContain(CODE);
  });

  it('hors preview : le choix MAILER est respecté (local console, prod smtp)', () => {
    expect(createMailer(env({ NODE_ENV: 'development' }))).toBeInstanceOf(
      ConsoleMailer,
    );
    expect(
      createMailer(
        env({
          NODE_ENV: 'production',
          MAILER: 'smtp',
          SMTP_HOST: 'mail.example.org',
        }),
      ),
    ).toBeInstanceOf(SmtpMailer);
  });
});
