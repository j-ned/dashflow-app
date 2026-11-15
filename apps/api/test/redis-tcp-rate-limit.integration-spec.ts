import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { RedisTcpRateLimitStore } from '../src/http/redis-tcp-rate-limit-store';

/**
 * Throttling partagé entre les instances de l'API sur le serveur (Dokploy) : Redis joint en TCP,
 * conteneur `dashflow-redis` de la pile. Ignoré sans RATE_LIMIT_REDIS_TCP_URL (redis://…).
 */
const url = process.env.RATE_LIMIT_REDIS_TCP_URL;

describe.skipIf(!url)('RedisTcpRateLimitStore (Redis réel, TCP)', () => {
  const opened: RedisTcpRateLimitStore[] = [];
  /** Une instance de l'API = un client Redis à elle. */
  const instance = async (): Promise<RedisTcpRateLimitStore> => {
    const store = new RedisTcpRateLimitStore(url ?? '');
    opened.push(store);
    await store.connect();
    return store;
  };

  afterAll(async () => {
    await Promise.all(opened.map((s) => s.close()));
  });

  it('compte, puis bloque au-delà de la limite sans compter pendant le blocage', async () => {
    const s = await instance();
    const key = `test:${randomUUID()}`;
    const rule = { limit: 2, ttlMs: 60_000, blockMs: 30_000 };

    expect(await s.increment(key, rule)).toEqual({
      totalHits: 1,
      isBlocked: false,
      timeToExpire: 60,
      timeToBlockExpire: 0,
    });
    expect(await s.increment(key, rule)).toMatchObject({
      totalHits: 2,
      isBlocked: false,
    });
    expect(await s.increment(key, rule)).toMatchObject({
      isBlocked: true,
      timeToBlockExpire: 30,
    });
    expect((await s.increment(key, rule)).isBlocked).toBe(true);
  });

  it('deux instances de l’API partagent le même compteur', async () => {
    const a = await instance();
    const b = await instance();
    const key = `test:${randomUUID()}`;
    const rule = { limit: 2, ttlMs: 60_000 };

    await a.increment(key, rule);
    await b.increment(key, rule);

    expect((await a.increment(key, rule)).isBlocked).toBe(true);
  });

  it('atomique entre instances : 25 requêtes simultanées sur 5 instances, limite 10 → exactement 10 passent', async () => {
    const instances = await Promise.all(
      Array.from({ length: 5 }, () => instance()),
    );
    const key = `test:${randomUUID()}`;
    const rule = { limit: 10, ttlMs: 60_000 };

    // Cinq requêtes par instance, toutes lancées en même temps.
    const callers = instances.flatMap((s) =>
      Array.from({ length: 5 }, () => s),
    );
    const results = await Promise.all(
      callers.map((s) => s.increment(key, rule)),
    );

    expect(results.filter((r) => !r.isBlocked)).toHaveLength(10);
  });

  it('clés indépendantes : bloquer l’une ne touche pas l’autre', async () => {
    const s = await instance();
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
