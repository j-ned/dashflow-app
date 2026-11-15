import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { claimJobSlot } from '../src/http/job-claims';
import { runScheduledTick } from '../src/http/scheduler';

// Plusieurs instances de l'API partagent la même base : chacune a sa propre horloge `cron`,
// et une tâche ne doit tourner qu'une fois par créneau, quel que soit le nombre d'instances.
const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

describe('Tâches planifiées multi-instances (intégration DB)', () => {
  afterAll(async () => {
    await sql.end();
  });

  it('une seule revendication réussit quand plusieurs instances visent le même créneau', async () => {
    const name = `job-${Date.now()}-concurrent`;
    const slot = new Date('2026-11-15T04:00:00.000Z');

    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimJobSlot(db, name, slot)),
    );

    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('le créneau suivant se revendique à nouveau, un créneau passé non', async () => {
    const name = `job-${Date.now()}-sequence`;
    const first = new Date('2026-11-15T04:00:00.000Z');
    const next = new Date('2026-11-15T10:00:00.000Z');

    expect(await claimJobSlot(db, name, first)).toBe(true);
    expect(await claimJobSlot(db, name, next)).toBe(true);
    expect(await claimJobSlot(db, name, first)).toBe(false);
  });

  it("une tâche déclenchée au même tick par trois instances ne s'exécute qu'une fois", async () => {
    let runs = 0;
    const name = `job-${Date.now()}-tick`;
    const run = () => {
      runs += 1;
      return Promise.resolve();
    };
    const tick = new Date('2026-11-15T04:00:00.000Z');

    await Promise.all([
      runScheduledTick(db, name, run, new Date(tick.getTime() - 30)),
      runScheduledTick(db, name, run, tick),
      runScheduledTick(db, name, run, new Date(tick.getTime() + 40)),
    ]);

    expect(runs).toBe(1);
  });
});
