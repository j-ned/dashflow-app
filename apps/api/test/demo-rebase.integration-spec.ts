import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { ConfigService } from '@nestjs/config';
import * as schema from '../src/db/schema';
import { DemoService } from '../src/modules/demo/demo.service';
import { today } from '../src/common/today';
import type { Env } from '../src/config/env.schema';

// Recalage temporel du démo, de bout en bout sur une vraie base : un jeu capturé il y a 100 jours
// (via le vrai scripts/demo-seed-snapshot.sql) doit ressortir cohérent avec « aujourd'hui ».
// max: 1 : le script de capture ouvre sa propre transaction (BEGIN…COMMIT), refusée sur un pool.
const client = postgres(process.env.DATABASE_URL!, {
  max: 1,
  onnotice: () => {},
});
const db = drizzle(client, { schema });
const config = { get: () => true } as unknown as ConfigService<Env, true>;

const DAYS_AGO = 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) =>
  iso(new Date(Date.parse(`${isoDate}T00:00:00Z`) + days * 86_400_000));
const monthOf = (isoDate: string, offset: number) => {
  const d = new Date(
    Date.UTC(
      Number(isoDate.slice(0, 4)),
      Number(isoDate.slice(5, 7)) - 1 + offset,
      1,
    ),
  );
  return iso(d).slice(0, 7);
};

describe('DemoService.reset : recalage temporel', () => {
  const now = today();
  const captured = addDays(now, -DAYS_AGO);
  let demoId: string;
  // Base déjà pourvue d'un compte démo (restaurée depuis la prod) : on n'y touche pas.
  let skipped = false;

  beforeAll(async () => {
    const existing =
      await client`select 1 from users where is_demo_account = true limit 1`;
    if (existing.length > 0) {
      skipped = true;
      console.warn(
        'Un compte démo existe déjà dans cette base — test de recalage ignoré',
      );
      return;
    }
    const [u] = await client<{ id: string }[]>`
      insert into users (email, display_name, is_demo_account, email_verified)
      values (${`demo-rebase-${Date.now()}@dashflow.test`}, 'Démo', true, now()) returning id`;
    demoId = u.id;
    const [patient] = await client<{ id: string }[]>`
      insert into patients (user_id, first_name, last_name, birth_date, color)
      values (${demoId}, 'Léa', 'Test', '2017-11-04', '#22aa88') returning id`;
    const [practitioner] = await client<{ id: string }[]>`
      insert into practitioners (user_id, name, type)
      values (${demoId}, 'Dr Martin', (select enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'practitioner_type' limit 1)::practitioner_type)
      returning id`;
    // Vu de la capture : un RDV passé (effectué), un le lendemain, un dans 60 jours.
    for (const [offset, status] of [
      [-30, 'completed'],
      [1, 'scheduled'],
      [60, 'scheduled'],
    ] as const) {
      await client`
        insert into appointments (user_id, patient_id, practitioner_id, date, time, status)
        values (${demoId}, ${patient.id}, ${practitioner.id}, ${addDays(captured, offset)}, '09:30', ${status})`;
    }
    const [account] = await client<{ id: string }[]>`
      insert into bank_accounts (user_id, name, initial_balance) values (${demoId}, 'Compte joint', 3200) returning id`;
    await client`
      insert into recurring_entries (user_id, account_id, label, amount, type, day_of_month)
      values (${demoId}, ${account.id}, 'Salaire', 2850, 'income', 27),
             (${demoId}, ${account.id}, 'Loyer', 1200, 'expense', 31),
             (${demoId}, ${account.id}, 'Taxe foncière', 1450, 'annual_expense', null)`;
    await client`
      insert into salary_archives (user_id, account_id, month, salary, total_expenses, total_spendings, spendings)
      values (${demoId}, ${account.id}, ${monthOf(captured, -2)}, 2850, 1200, 0, '[]'::jsonb)`;
    await client.unsafe(
      readFileSync(
        join(__dirname, '..', 'scripts', 'demo-seed-snapshot.sql'),
        'utf8',
      ),
    );
    await client`update demo_seed_meta set reference_date = ${captured}`;
  });

  afterAll(async () => {
    if (!skipped) await client`delete from users where id = ${demoId}`;
    await client.end();
  });

  it('rendez-vous : recalés par semaines entières, jamais un dimanche, aucun « planifié » dans le passé', async () => {
    if (skipped) return;
    await new DemoService(db, config).reset();

    const rows = await client<{ date: string; status: string; dow: number }[]>`
      select to_char(date, 'YYYY-MM-DD') as date, status, extract(dow from date)::int as dow
      from appointments where user_id = ${demoId} order by date`;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.dow !== 0)).toBe(true);
    expect(
      rows.filter((r) => r.status === 'scheduled' && r.date < now),
    ).toEqual([]);
    // 100 jours = 14 semaines pleines (98 j) : le RDV « dans 60 jours » reste à venir.
    const last = rows[rows.length - 1];
    expect(last.status).toBe('scheduled');
    expect(last.date >= addDays(captured, 60 + 98)).toBe(true);
    expect(last.date > now).toBe(true);
  });

  it('budget : archive recalée en mois, mois clos rempli par les échéances mensuelles, idempotent', async () => {
    if (skipped) return;
    const svc = new DemoService(db, config);
    await svc.reset();
    await svc.reset();

    const months =
      Number(now.slice(0, 4)) * 12 +
      Number(now.slice(5, 7)) -
      (Number(captured.slice(0, 4)) * 12 + Number(captured.slice(5, 7)));
    const [archive] = await client<
      { month: string }[]
    >`select month from salary_archives where user_id = ${demoId}`;
    expect(archive.month).toBe(monthOf(captured, -2 + months));

    const previous = monthOf(now, -1);
    const txs = await client<
      { date: string; direction: string; amount: string; label: string }[]
    >`
      select to_char(t.date, 'YYYY-MM-DD') as date, t.direction, t.amount, r.label
      from account_transactions t join recurring_entries r on r.id = t.recurring_entry_id
      where t.user_id = ${demoId} order by r.label`;
    // Une opération par échéance mensuelle (pas l'annuelle), une seule fois malgré deux resets.
    expect(txs.map((t) => [t.label, t.direction])).toEqual([
      ['Loyer', 'expense'],
      ['Salaire', 'income'],
    ]);
    expect(txs.every((t) => t.date.startsWith(previous))).toBe(true);
    // Échéance le 31 : ramenée au dernier jour d'un mois plus court.
    const lastDay = new Date(
      Date.UTC(Number(previous.slice(0, 4)), Number(previous.slice(5, 7)), 0),
    ).getUTCDate();
    expect(txs[0].date).toBe(
      `${previous}-${String(Math.min(31, lastDay)).padStart(2, '0')}`,
    );
  });
});
