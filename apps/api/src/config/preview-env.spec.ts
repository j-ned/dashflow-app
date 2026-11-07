import { describe, it, expect } from 'vitest';
import { deploymentTier, envSchema, servesOverHttps } from './env.schema';

// Ce que Vercel pose sur une preview : VERCEL=1, VERCEL_ENV=preview, et (peut-être) NODE_ENV=production.
// Aucune variable du projet en dehors de celles créées pour la cible Preview.
const preview = {
  NODE_ENV: 'production',
  VERCEL: '1',
  VERCEL_ENV: 'preview',
  DATABASE_URL: 'postgres://u:p@preview.neon.tech:5432/dashflow',
  JWT_SECRET: 'P' + 'r3view-secret-'.repeat(3),
  DEMO_ENABLED: 'true',
};

const issuesOf = (input: Record<string, unknown>): string[] => {
  const r = envSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('deploymentTier', () => {
  it.each([
    [{ VERCEL_ENV: 'production', NODE_ENV: 'production' }, 'production'],
    // Prod Vercel sans NODE_ENV : garde-fous de prod quand même.
    [{ VERCEL_ENV: 'production', NODE_ENV: 'development' }, 'production'],
    [{ VERCEL_ENV: 'preview', NODE_ENV: 'production' }, 'preview'],
    [{ VERCEL_ENV: 'preview', NODE_ENV: 'development' }, 'preview'],
    // Docker / Dokploy : pas de VERCEL_ENV, NODE_ENV=production → production (inchangé).
    [{ NODE_ENV: 'production' }, 'production'],
    [{ VERCEL_ENV: 'development', NODE_ENV: 'production' }, 'production'],
    [{ NODE_ENV: 'development' }, 'local'],
    [{ NODE_ENV: 'test' }, 'local'],
    [{ VERCEL_ENV: 'development', NODE_ENV: 'development' }, 'local'],
  ] as const)('%o → %s', (env, tier) => {
    expect(deploymentTier(env)).toBe(tier);
  });

  it('Cookies Secure et Origin exigée partout sauf en local', () => {
    expect(servesOverHttps({ VERCEL_ENV: 'preview', NODE_ENV: 'test' })).toBe(
      true,
    );
    expect(servesOverHttps({ NODE_ENV: 'production' })).toBe(true);
    expect(servesOverHttps({ NODE_ENV: 'development' })).toBe(false);
  });
});

describe('envSchema — preview Vercel', () => {
  it('démarre avec seulement DATABASE_URL, JWT_SECRET et DEMO_ENABLED, même si NODE_ENV=production', () => {
    expect(issuesOf(preview)).toEqual([]);
  });

  it('démarre aussi si une variable SMTP de prod traîne en Preview (elle sera ignorée)', () => {
    expect(issuesOf({ ...preview, MAILER: 'smtp' })).toEqual([]);
  });

  it('refuse quand même le JWT_SECRET d’exemple : une preview est exposée sur Internet', () => {
    expect(
      issuesOf({
        ...preview,
        JWT_SECRET: 'dev-secret-change-me-min-32-characters-long-xxxxx',
      }),
    ).toContain('JWT_SECRET');
  });

  it('rejette un VERCEL_ENV inconnu plutôt que de deviner', () => {
    expect(issuesOf({ ...preview, VERCEL_ENV: 'staging' })).toContain(
      'VERCEL_ENV',
    );
  });

  it('rejette un VERCEL_URL qui n’est pas un nom d’hôte', () => {
    expect(
      issuesOf({ ...preview, VERCEL_URL: 'https://evil.example/x' }),
    ).toContain('VERCEL_URL');
  });
});

describe('envSchema — production Vercel au moins aussi stricte qu’avant', () => {
  const prodVercel = { ...preview, VERCEL_ENV: 'production' };

  it('exige Redis, CRON_SECRET et SMTP quand VERCEL_ENV=production', () => {
    expect(issuesOf(prodVercel)).toEqual(
      expect.arrayContaining(['KV_REST_API_URL', 'CRON_SECRET', 'MAILER']),
    );
  });

  it('les exige même si NODE_ENV n’est pas production', () => {
    expect(issuesOf({ ...prodVercel, NODE_ENV: 'development' })).toEqual(
      expect.arrayContaining(['KV_REST_API_URL', 'CRON_SECRET', 'MAILER']),
    );
  });
});
