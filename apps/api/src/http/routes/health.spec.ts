import { describe, it, expect, vi } from 'vitest';
import { honoTestApp, TEST_ENV } from '../../../test/support/hono-test-app';
import type { DrizzleDB } from '../../db/drizzle.constants';
import { RateLimitStore, type RateLimiter } from '../rate-limit-store';

const TOKEN = 'un-jeton-de-sante-assez-long-0123';

/** Redis vu par /health/ready : absent (compteurs en mémoire), joignable, en panne ou figé. */
type RedisState = 'absent' | 'up' | 'down' | 'hung';

const limiterWith = (state: RedisState): RateLimiter => {
  const memory = new RateLimitStore();
  if (state === 'absent') return memory;
  const ping =
    state === 'up'
      ? () => Promise.resolve()
      : state === 'down'
        ? () => Promise.reject(new Error('ECONNREFUSED 10.0.0.7:6379'))
        : () => new Promise<void>(() => undefined);
  return {
    increment: (k, r) => memory.increment(k, r),
    dispose: () => memory.dispose(),
    ping,
  };
};

async function make(
  opts: { token?: string; dbFails?: boolean; redis?: RedisState } = {},
) {
  const execute = opts.dbFails
    ? vi.fn().mockRejectedValue(new Error('down'))
    : vi.fn().mockResolvedValue([{ '?column?': 1 }]);
  const t = await honoTestApp({
    db: { execute } as unknown as DrizzleDB,
    env: { ...TEST_ENV, HEALTH_TOKEN: opts.token },
    rateLimits: limiterWith(opts.redis ?? 'absent'),
  });
  const ready = (presented?: string) =>
    t.anonymous(
      '/health/ready',
      presented ? { headers: { 'X-Health-Token': presented } } : undefined,
    );
  return { t, execute, ready };
}

describe('Routes /health (Hono)', () => {
  it('GET /health : sonde de vie sans détail, qui ne touche pas la base', async () => {
    const { t, execute } = await make({ dbFails: true });
    const res = await t.anonymous('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['aucun jeton configuré', undefined, TOKEN],
    ['jeton absent de la requête', TOKEN, undefined],
    ['mauvais jeton', TOKEN, 'un-autre-jeton-de-la-meme-taille-0'],
    ['jeton de longueur différente', TOKEN, 'court'],
  ])(
    'GET /health/ready, %s → 404 sans interroger la base',
    async (_label, configured, presented) => {
      const { execute, ready } = await make({ token: configured });
      expect((await ready(presented)).status).toBe(404);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it('GET /health/ready avec le bon jeton : base joignable → ok', async () => {
    const { ready } = await make({ token: TOKEN });
    const res = await ready(TOKEN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true });
  });

  it('GET /health/ready avec le bon jeton : base en panne → 503', async () => {
    const { ready } = await make({ token: TOKEN, dbFails: true });
    expect((await ready(TOKEN)).status).toBe(503);
  });

  it('GET /health/ready : Redis utilisé et joignable → ok, redis vérifié', async () => {
    const { ready } = await make({ token: TOKEN, redis: 'up' });
    const res = await ready(TOKEN);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, db: true, redis: true });
  });

  it('GET /health/ready : Redis en panne → 503 sans détail technique, alors que /health reste à 200', async () => {
    const { t, ready } = await make({ token: TOKEN, redis: 'down' });
    const res = await ready(TOKEN);
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).toContain('Redis injoignable');
    expect(body).not.toContain('10.0.0.7');
    expect((await t.anonymous('/health')).status).toBe(200);
  });

  it('GET /health/ready : Redis qui ne répond plus → 503 au bout de 2 s, sans bloquer la sonde', async () => {
    vi.useFakeTimers();
    try {
      const { ready } = await make({ token: TOKEN, redis: 'hung' });
      const pending = ready(TOKEN);
      await vi.advanceTimersByTimeAsync(2_000);
      expect((await pending).status).toBe(503);
    } finally {
      vi.useRealTimers();
    }
  });
});
