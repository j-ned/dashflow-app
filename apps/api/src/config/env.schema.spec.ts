import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    CORS_ORIGIN: 'http://localhost:4200',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('applique les valeurs par défaut', () => {
    const env = envSchema.parse(base);
    expect(env.PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('rejette une DATABASE_URL manquante', () => {
    expect(() => envSchema.parse({ CORS_ORIGIN: base.CORS_ORIGIN })).toThrow();
  });

  it('coerce PORT en nombre', () => {
    const env = envSchema.parse({ ...base, PORT: '4000' });
    expect(env.PORT).toBe(4000);
  });

  it('exige JWT_SECRET >= 32 chars', () => {
    expect(() => envSchema.parse({ ...base, JWT_SECRET: 'court' })).toThrow();
    const env = envSchema.parse({ ...base, JWT_SECRET: 'x'.repeat(32) });
    expect(env.JWT_SECRET).toHaveLength(32);
  });

  it('MAILER par défaut = console', () => {
    expect(envSchema.parse({ ...base }).MAILER).toBe('console');
  });
});

describe('envSchema — garde-fous production', () => {
  const prod = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://u:p@db:5432/db',
    JWT_SECRET: 'A' + 'r4nd0m-secret-'.repeat(3),
    MAILER: 'smtp',
    SMTP_HOST: 'mail.example.org',
  };

  it('accepte une config prod complète', () => {
    expect(() => envSchema.parse(prod)).not.toThrow();
  });

  it('refuse MAILER=console en production (codes OTP dans les logs)', () => {
    expect(() => envSchema.parse({ ...prod, MAILER: 'console' })).toThrow(
      /MAILER/,
    );
  });

  it('refuse MAILER=smtp sans SMTP_HOST en production', () => {
    expect(() => envSchema.parse({ ...prod, SMTP_HOST: undefined })).toThrow(
      /MAILER/,
    );
  });

  it('refuse le JWT_SECRET d’exemple du .env.example en production', () => {
    expect(() =>
      envSchema.parse({
        ...prod,
        JWT_SECRET: 'dev-secret-change-me-min-32-characters-long-xxxxx',
      }),
    ).toThrow(/JWT_SECRET/);
  });

  it('tolère console et le secret d’exemple hors production', () => {
    expect(() =>
      envSchema.parse({
        ...prod,
        NODE_ENV: 'development',
        MAILER: 'console',
        JWT_SECRET: 'dev-secret-change-me-min-32-characters-long-xxxxx',
      }),
    ).not.toThrow();
  });
});
