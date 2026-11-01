import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { AdminRepository } from '../src/modules/admin/admin.repository';
import { AdminService } from '../src/modules/admin/admin.service';
import type { Mailer } from '../src/mail/mailer';

// Tâche planifiée (cron), sans route HTTP : testée directement contre la base, hors e2e.
const sql = postgres(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });
const mailer = {} as Mailer;

describe('AdminService.purgeStaleUnverified (intégration DB)', () => {
  const svc = new AdminService(new AdminRepository(db), mailer);

  afterAll(async () => {
    await sql.end();
  });

  it('purge nocturne : plus de 7 jours et jamais vérifié, sauf code demandé dans les 24 h', async () => {
    const tag = Date.now();
    const old = `old+${tag}@dashflow.test`;
    const recent = `recent+${tag}@dashflow.test`;
    const retrying = `retry+${tag}@dashflow.test`;
    const verified = `verified+${tag}@dashflow.test`;
    await sql`insert into users (email, password, created_at) values
      (${old}, 'x', now() - interval '8 days'),
      (${recent}, 'x', now() - interval '2 days'),
      (${retrying}, 'x', now() - interval '30 days')`;
    await sql`insert into users (email, password, created_at, email_verified) values
      (${verified}, 'x', now() - interval '30 days', now())`;
    // Réinscription en cours sur une vieille ligne : un code vient d'être demandé.
    await sql`insert into verification_codes (email, code, expires_at) values (${retrying}, 'h', now() + interval '10 minutes')`;

    await svc.purgeStaleUnverified();

    const left = await sql<
      { email: string }[]
    >`select email from users where email in ${sql([old, recent, retrying, verified])}`;
    expect(left.map((r) => r.email).sort()).toEqual(
      [recent, retrying, verified].sort(),
    );
  });
});
