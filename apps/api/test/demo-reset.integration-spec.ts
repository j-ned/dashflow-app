import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { ConfigService } from '@nestjs/config';
import * as schema from '../src/db/schema';
import { DemoService } from '../src/modules/demo/demo.service';
import type { Env } from '../src/config/env.schema';

// DATABASE_URL est injecté via vitest.integration.config.ts. Requiert une DB locale
// restaurée depuis la prod (`make db-restore`) afin d'avoir le compte démo + les snapshots
// demo_seed_*. Ce test reproduit la cause racine suspectée du reset cassé en prod
// (user_id de snapshot périmé → violation FK) et vérifie que le re-pointage la neutralise.
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });
const config = { get: () => true } as unknown as ConfigService<Env, true>;

describe('DemoService.reset (intégration DB locale)', () => {
  afterAll(async () => {
    await client.end();
  });

  const svc = new DemoService(db, config);

  it('réinitialise le compte démo sans erreur FK, même avec un user_id de snapshot périmé', async () => {
    const demo = await client<{ id: string }[]>`select id from users where is_demo_account = true limit 1`;
    if (demo.length === 0) {
      console.warn('Pas de compte démo en DB locale — test ignoré');
      return;
    }
    const demoId = demo[0].id;

    const seed = await client<{ reg: string | null }[]>`select to_regclass('public.demo_seed_shared_access') as reg`;
    const hasSeed = seed[0].reg != null;

    // Simule l'échec rapporté : le snapshot pointe un user inexistant (compte démo recréé).
    if (hasSeed) {
      await client`update demo_seed_shared_access set user_id = gen_random_uuid()`;
    }

    // Avant le fix, ceci levait : insert into shared_access ... → violation FK user_id.
    await expect(svc.reset()).resolves.toBeUndefined();

    // Après restauration, toutes les lignes sont rattachées au compte démo courant.
    if (hasSeed) {
      const rows = await client<{ user_id: string }[]>`select user_id from shared_access`;
      for (const r of rows) expect(r.user_id).toBe(demoId);
    }
  });
});
