import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import type { DrizzleDB } from '../db/drizzle.constants';
import type { Env } from '../config/env.schema';
import { TokenService } from '../auth/token.service';
import { CsrfService } from '../auth/csrf.service';
import { CsrfPolicy } from '../auth/csrf-policy';
import { RoleChecker } from '../auth/role-checker';
import { SessionAuthenticator } from '../auth/session-authenticator';
import { RateLimitStore } from './rate-limit-store';

/** Tout ce dont la couche HTTP Hono a besoin, construit une fois au démarrage. */
export type HttpDeps = {
  readonly env: Env;
  readonly db: DrizzleDB;
  readonly sessions: SessionAuthenticator;
  readonly csrf: CsrfService;
  readonly csrfPolicy: CsrfPolicy;
  readonly roles: RoleChecker;
  readonly rateLimits: RateLimitStore;
};

/** Racine de composition : remplace l'injection de dépendances de Nest. */
export function createDeps(env: Env): {
  deps: HttpDeps;
  close: () => Promise<void>;
} {
  const client = postgres(env.DATABASE_URL);
  const db = drizzle(client, { schema });
  const tokens = new TokenService(env);
  const csrf = new CsrfService(env);
  const rateLimits = new RateLimitStore();
  return {
    deps: {
      env,
      db,
      sessions: new SessionAuthenticator(tokens, db),
      csrf,
      csrfPolicy: new CsrfPolicy(csrf, env),
      roles: new RoleChecker(db),
      rateLimits,
    },
    close: async () => {
      rateLimits.dispose();
      // Rend les connexions à Postgres au lieu de les laisser tomber à la mort du processus.
      await client.end({ timeout: 5 });
    },
  };
}
