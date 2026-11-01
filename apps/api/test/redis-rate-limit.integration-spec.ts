import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RedisRateLimitStore } from '../src/http/redis-rate-limit-store';

/**
 * Throttling partagé (Vercel) contre un vrai Redis via son API REST : Upstash en production,
 * l'émulateur `hiett/serverless-redis-http` en local et en CI. Ignoré sans RATE_LIMIT_REDIS_URL.
 */
const url = process.env.RATE_LIMIT_REDIS_URL;
const token = process.env.RATE_LIMIT_REDIS_TOKEN;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!url || !token)('RedisRateLimitStore (Redis réel)', () => {
  const store = () => new RedisRateLimitStore({ url: url!, token: token! });

  it('compte, bloque au-delà de la limite pour toute la durée, puis repart de zéro', async () => {
    const s = store();
    const key = `test:${randomUUID()}`;
    const rule = { limit: 2, ttlMs: 60_000, blockMs: 1_500 };
    expect(await s.increment(key, rule)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
      timeToExpire: 60,
    });
    expect(await s.increment(key, rule)).toMatchObject({
      totalHits: 2,
      isBlocked: false,
    });
    expect(await s.increment(key, rule)).toMatchObject({
      isBlocked: true,
      timeToBlockExpire: 2,
    });
    expect((await s.increment(key, rule)).isBlocked).toBe(true); // pas compté pendant le blocage
    await sleep(1_700);
    expect(await s.increment(key, rule)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('fenêtre glissante : chaque requête expire individuellement', async () => {
    const s = store();
    const key = `test:${randomUUID()}`;
    const rule = { limit: 2, ttlMs: 1_000 };
    await s.increment(key, rule);
    await s.increment(key, rule);
    await sleep(1_100);
    expect(await s.increment(key, rule)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });

  it('atomique entre instances : 25 requêtes simultanées, limite 10 → exactement 10 passent', async () => {
    const key = `test:${randomUUID()}`;
    const rule = { limit: 10, ttlMs: 60_000 };
    // Une instance par requête, comme des fonctions Vercel distinctes.
    const results = await Promise.all(
      Array.from({ length: 25 }, () => store().increment(key, rule)),
    );
    expect(results.filter((r) => !r.isBlocked)).toHaveLength(10);
  });

  it('clés indépendantes : bloquer l’une ne touche pas l’autre', async () => {
    const s = store();
    const rule = { limit: 1, ttlMs: 60_000 };
    const a = `test:${randomUUID()}`;
    const b = `test:${randomUUID()}`;
    await s.increment(a, rule);
    expect((await s.increment(a, rule)).isBlocked).toBe(true);
    expect(await s.increment(b, rule)).toMatchObject({
      totalHits: 1,
      isBlocked: false,
    });
  });
});
