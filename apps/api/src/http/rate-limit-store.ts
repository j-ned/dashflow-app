export type ThrottleRule = {
  readonly limit: number;
  readonly ttlMs: number;
  /** Durée du blocage une fois la limite dépassée ; défaut = ttlMs (comme @nestjs/throttler). */
  readonly blockMs?: number;
};

export type ThrottleResult = {
  readonly totalHits: number;
  readonly isBlocked: boolean;
  /** Secondes avant la fin de la fenêtre courante (en-tête X-RateLimit-Reset). */
  readonly timeToExpire: number;
  /** Secondes avant la fin du blocage (en-tête Retry-After). */
  readonly timeToBlockExpire: number;
};

type Entry = {
  ttlMs: number;
  hits: number[];
  expiresAt: number;
  blockExpiresAt: number;
  isBlocked: boolean;
};

const SWEEP_INTERVAL_MS = 60_000;

/**
 * Compteurs en mémoire, par processus — même sémantique que le stockage de @nestjs/throttler v6 :
 * chaque requête comptée expire individuellement au bout du TTL ; au-delà de la limite la clé
 * est bloquée `blockMs`, sans compter les requêtes reçues pendant le blocage.
 * Sans son défaut : lever le blocage d'une clé ne réinitialise pas les compteurs des autres.
 */
export class RateLimitStore {
  private readonly entries = new Map<string, Entry>();
  private readonly sweeper: NodeJS.Timeout;

  constructor(private readonly now: () => number = Date.now) {
    this.sweeper = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  increment(key: string, rule: ThrottleRule): ThrottleResult {
    const now = this.now();
    const blockMs = rule.blockMs ?? rule.ttlMs;
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        ttlMs: rule.ttlMs,
        hits: [],
        expiresAt: now + rule.ttlMs,
        blockExpiresAt: 0,
        isBlocked: false,
      };
      this.entries.set(key, entry);
    }
    if (entry.expiresAt <= now) entry.expiresAt = now + rule.ttlMs;
    entry.hits = entry.hits.filter((t) => t > now - rule.ttlMs);

    if (!entry.isBlocked) entry.hits.push(now);
    if (!entry.isBlocked && entry.hits.length > rule.limit) {
      entry.isBlocked = true;
      entry.blockExpiresAt = now + blockMs;
    }
    if (entry.isBlocked && entry.blockExpiresAt <= now) {
      entry.isBlocked = false;
      entry.hits = [now];
    }
    return {
      totalHits: entry.hits.length,
      isBlocked: entry.isBlocked,
      timeToExpire: Math.ceil((entry.expiresAt - now) / 1000),
      timeToBlockExpire: Math.ceil((entry.blockExpiresAt - now) / 1000),
    };
  }

  dispose(): void {
    clearInterval(this.sweeper);
    this.entries.clear();
  }

  /** Oublie les clés sans requête encore comptée ni blocage en cours. */
  private sweep(): void {
    const now = this.now();
    for (const [key, entry] of this.entries) {
      const counting = entry.hits.some((t) => t > now - entry.ttlMs);
      const blocked = entry.isBlocked && entry.blockExpiresAt > now;
      if (!counting && !blocked) this.entries.delete(key);
    }
  }
}
