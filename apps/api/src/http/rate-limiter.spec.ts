import { describe, it, expect, afterEach } from 'vitest';
import { createRateLimiter, type RateLimiterHandle } from './rate-limiter';
import { RateLimitStore } from './rate-limit-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';

let handle: RateLimiterHandle | undefined;
afterEach(async () => {
  await handle?.close();
  handle = undefined;
});

describe('createRateLimiter', () => {
  it('REDIS_URL réglée : compteurs partagés dans Redis', () => {
    handle = createRateLimiter({ REDIS_URL: 'redis://dashflow-redis:6379' });

    expect(handle.limiter).toBeInstanceOf(RedisRateLimitStore);
  });

  it('sans Redis : compteurs en mémoire, prêts tout de suite', async () => {
    handle = createRateLimiter({ REDIS_URL: undefined });

    expect(handle.limiter).toBeInstanceOf(RateLimitStore);
    await expect(handle.connect()).resolves.toBeUndefined();
  });
});
