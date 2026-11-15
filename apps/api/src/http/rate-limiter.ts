import { redisRestConfig, type Env } from '../config/env.schema';
import { RateLimitStore, type RateLimiter } from './rate-limit-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';
import { RedisTcpRateLimitStore } from './redis-tcp-rate-limit-store';

export type RateLimiterHandle = {
  readonly limiter: RateLimiter;
  /** Établit la connexion (Redis) ; se résout quand le stockage est utilisable. */
  readonly connect: () => Promise<void>;
  /** Libère le stockage (ferme la connexion Redis). */
  readonly close: () => Promise<void>;
};

/**
 * Stockage des compteurs de throttling, du plus partagé au plus local :
 * - REDIS_URL (Dokploy) : Redis de la pile, en TCP, partagé par toutes les instances ;
 * - Redis REST (Vercel, Upstash) : partagé, par l'API HTTP ;
 * - sinon en mémoire : correct pour un seul processus, remis à zéro à chaque redémarrage.
 */
export function createRateLimiter(
  env: Pick<
    Env,
    | 'REDIS_URL'
    | 'KV_REST_API_URL'
    | 'KV_REST_API_TOKEN'
    | 'UPSTASH_REDIS_REST_URL'
    | 'UPSTASH_REDIS_REST_TOKEN'
  >,
): RateLimiterHandle {
  if (env.REDIS_URL) {
    const store = new RedisTcpRateLimitStore(env.REDIS_URL);
    return {
      limiter: store,
      connect: () => store.connect(),
      close: () => store.close(),
    };
  }
  const rest = redisRestConfig(env);
  const limiter = rest ? new RedisRateLimitStore(rest) : new RateLimitStore();
  return {
    limiter,
    connect: () => Promise.resolve(),
    close: () => {
      limiter.dispose();
      return Promise.resolve();
    },
  };
}
