import { describe, it, expect } from 'vitest';
import { createApp } from './app';
import { createDepsWith } from './deps';
import { TEST_ENV } from '../../test/support/hono-test-app';
import { envSchema } from '../config/env.schema';
import type { DrizzleDB } from '../db/drizzle.constants';
import type { Mailer } from '../mail/mailer';

const BASE_ENV = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db.example.com:5432/dashflow',
  JWT_SECRET: 'z'.repeat(48),
  MAILER: 'smtp',
  SMTP_HOST: 'mail.example.com',
};

describe('Déploiement Vercel', () => {
  it('l’app sert ses routes sous /api (la fonction reçoit le chemin complet)', async () => {
    const app = createApp(
      createDepsWith(TEST_ENV, {} as DrizzleDB, {} as Mailer),
      {
        basePath: '/api',
      },
    );
    expect((await app.request('/api/health')).status).toBe(200);
    expect((await app.request('/health')).status).toBe(404);
  });

  it('refuse de démarrer sur Vercel sans Redis ni CRON_SECRET', () => {
    const r = envSchema.safeParse({ ...BASE_ENV, VERCEL: '1' });
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(
      expect.arrayContaining(['KV_REST_API_URL', 'CRON_SECRET']),
    );
  });

  it('accepte Vercel avec Redis (noms Vercel ou Upstash) et CRON_SECRET', () => {
    for (const redis of [
      { KV_REST_API_URL: 'https://r.upstash.io', KV_REST_API_TOKEN: 't' },
      {
        UPSTASH_REDIS_REST_URL: 'https://r.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 't',
      },
    ])
      expect(
        envSchema.safeParse({
          ...BASE_ENV,
          VERCEL: '1',
          CRON_SECRET: 's'.repeat(32),
          ...redis,
        }).success,
      ).toBe(true);
  });

  it('hors Vercel, ni Redis ni CRON_SECRET ne sont exigés (Docker, local)', () => {
    expect(envSchema.safeParse(BASE_ENV).success).toBe(true);
  });
});
