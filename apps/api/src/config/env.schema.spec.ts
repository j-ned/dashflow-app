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
