import { describe, it, expect, afterEach } from 'vitest';
import { createRateLimiter, type RateLimiterHandle } from './rate-limiter';
import { RateLimitStore } from './rate-limit-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';
import { RedisTcpRateLimitStore } from './redis-tcp-rate-limit-store';

const noRedis = {
  REDIS_URL: undefined,
  KV_REST_API_URL: undefined,
  KV_REST_API_TOKEN: undefined,
  UPSTASH_REDIS_REST_URL: undefined,
  UPSTASH_REDIS_REST_TOKEN: undefined,
};

let handle: RateLimiterHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe('createRateLimiter', () => {
  it('REDIS_URL réglée : compteurs partagés dans Redis, joint en TCP', () => {
    handle = createRateLimiter({
      ...noRedis,
      REDIS_URL: 'redis://dashflow-redis:6379',
    });

    expect(handle.limiter).toBeInstanceOf(RedisTcpRateLimitStore);
  });

  it('Redis REST (Upstash, Vercel) : compteurs partagés par l’API HTTP', async () => {
    handle = createRateLimiter({
      ...noRedis,
      UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
      UPSTASH_REDIS_REST_TOKEN: 'token',
    });

    expect(handle.limiter).toBeInstanceOf(RedisRateLimitStore);
    await expect(handle.connect()).resolves.toBeUndefined();
  });

  it('sans Redis : compteurs en mémoire, prêts tout de suite', async () => {
    handle = createRateLimiter(noRedis);

    expect(handle.limiter).toBeInstanceOf(RateLimitStore);
    await expect(handle.connect()).resolves.toBeUndefined();
  });
});
