import { describe, it, expect } from 'vitest';
import { envSchema } from './env.schema';

describe('envSchema', () => {
  const base = {
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
    CORS_ORIGIN: 'http://localhost:4200',
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
});
