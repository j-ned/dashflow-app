import { Redis } from '@upstash/redis';
import { randomUUID } from 'node:crypto';
import type { ThrottleResult, ThrottleRule } from './rate-limit-store';

/**
 * Même sémantique que RateLimitStore (fenêtre glissante, blocage `blockMs`, requêtes non comptées
 * pendant le blocage), mais partagée entre toutes les instances : sur Vercel, chaque instance a
 * sa propre mémoire et un compteur local serait contournable. Un seul script Lua par requête :
 * lecture-décision-écriture atomiques, pas de course entre instances.
 *
 * KEYS : [coups (zset), blocage (chaîne à durée de vie), fenêtre (chaîne à durée de vie)]
 * ARGV : [maintenant ms, ttl ms, limite, blocage ms, membre unique]
 * Rend : [coups comptés, bloqué (0/1), ms avant fin de fenêtre, ms avant fin du blocage]
 */
const SCRIPT = `
local now = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local block = tonumber(ARGV[4])

local blocked = redis.call('PTTL', KEYS[2])
local window = redis.call('PTTL', KEYS[3])
if blocked > 0 then
  return { redis.call('ZCARD', KEYS[1]), 1, math.max(window, 0), blocked }
end

if window <= 0 then
  redis.call('SET', KEYS[3], '1', 'PX', ttl)
  window = ttl
end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - ttl)
redis.call('ZADD', KEYS[1], now, ARGV[5])
redis.call('PEXPIRE', KEYS[1], ttl)
local hits = redis.call('ZCARD', KEYS[1])
if hits > limit then
  redis.call('SET', KEYS[2], '1', 'PX', block)
  -- À la levée du blocage, le compteur repart de zéro (comme le stockage en mémoire).
  redis.call('DEL', KEYS[1])
  return { hits, 1, window, block }
end
return { hits, 0, window, 0 }
`;

export class RedisRateLimitStore {
  private readonly redis: Redis;

  constructor(config: { url: string; token: string }) {
    this.redis = new Redis({ url: config.url, token: config.token });
  }

  async increment(key: string, rule: ThrottleRule): Promise<ThrottleResult> {
    const base = `rl:${key}`;
    const [hits, blocked, windowMs, blockMs] = await this.redis.eval<
      string[],
      [number, number, number, number]
    >(
      SCRIPT,
      [`${base}:hits`, `${base}:block`, `${base}:window`],
      [
        String(Date.now()),
        String(rule.ttlMs),
        String(rule.limit),
        String(rule.blockMs ?? rule.ttlMs),
        randomUUID(),
      ],
    );
    return {
      totalHits: hits,
      isBlocked: blocked === 1,
      timeToExpire: Math.ceil(windowMs / 1000),
      timeToBlockExpire: Math.ceil(blockMs / 1000),
    };
  }

  /** Rien à libérer : client HTTP sans connexion persistante. */
  dispose(): void {}
}
