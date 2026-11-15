import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/db/schema';
import { PrescriptionsService } from '../src/modules/prescriptions/prescriptions.service';
import { NotFoundError } from '../src/common/errors';
import type { StorageService } from '../src/storage/storage.service';

// Une ordonnance ne se rattache qu'aux ressources de son propriétaire : patient, praticien et
// rendez-vous. Sans vérification, A pourrait la lier au rendez-vous de B (identifiant deviné ou
// divulgué), apprendre qu'il existe, et la voir supprimée en cascade avec lui.
const sql = postgres(process.env.DATABASE_URL ?? '');
// Le stockage des fichiers n'intervient pas dans ces vérifications.
const svc = new PrescriptionsService(
  drizzle(sql, { schema }),
  {} as StorageService,
);

type Household = { userId: string; patientId: string; appointmentId: string };

async function household(label: string): Promise<Household> {
  const [user] = await sql<{ id: string }[]>`
    insert into users (email, password, email_verified)
    values (${`${label}+${Date.now()}-${Math.random()}@dashflow.test`}, 'x', now()) returning id`;
  if (!user) throw new Error('compte non créé');
  const [patient] = await sql<{ id: string }[]>`
    insert into patients (user_id, first_name, last_name) values (${user.id}, 'P', 'P') returning id`;
  const [practitioner] = await sql<{ id: string }[]>`
    insert into practitioners (user_id, name, type) values (${user.id}, 'Dr', 'generaliste') returning id`;
  if (!patient || !practitioner) throw new Error('fiches non créées');
  const [appointment] = await sql<{ id: string }[]>`
    insert into appointments (user_id, patient_id, practitioner_id, date, time)
    values (${user.id}, ${patient.id}, ${practitioner.id}, current_date, '09:00') returning id`;
  if (!appointment) throw new Error('rendez-vous non créé');
  return {
    userId: user.id,
    patientId: patient.id,
    appointmentId: appointment.id,
  };
}

describe('PrescriptionsService : rendez-vous rattaché (intégration DB)', () => {
  let a: Household;
  let b: Household;

  beforeAll(async () => {
    a = await household('a');
    b = await household('b');
  });

  afterAll(async () => {
    await sql.end();
  });

  const values = (appointmentId: string) => ({
    patientId: a.patientId,
    appointmentId,
    issuedDate: '2026-11-15',
  });

  it('création rattachée au rendez-vous d’un autre compte : refusée', async () => {
    await expect(
      svc.create(a.userId, values(b.appointmentId)),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('création rattachée à son propre rendez-vous : acceptée', async () => {
    const created = await svc.create(a.userId, values(a.appointmentId));

    expect(created.appointmentId).toBe(a.appointmentId);
  });

  it('modification vers le rendez-vous d’un autre compte : refusée', async () => {
    const own = await svc.create(a.userId, values(a.appointmentId));

    await expect(
      svc.update(a.userId, own.id, { appointmentId: b.appointmentId }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
