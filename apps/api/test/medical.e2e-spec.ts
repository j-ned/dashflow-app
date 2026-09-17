import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/mail/mailer';

class CapturingMailer implements Mailer {
  lastCode = '';
  sendVerificationCode(_to: string, code: string): Promise<void> {
    this.lastCode = code;
    return Promise.resolve();
  }
  sendPasswordResetCode(_to: string, code: string): Promise<void> {
    this.lastCode = code;
    return Promise.resolve();
  }
}

describe('Medical e2e', () => {
  let app: INestApplication;
  const mailer = new CapturingMailer();

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
    app = m.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  async function authedClient() {
    const s = app.getHttpServer();
    const email = `med+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
    await request(s)
      .post('/auth/register')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(201);
    const v = await request(s)
      .post('/auth/verify')
      .send({ email, code: mailer.lastCode })
      .expect(200);
    const sessionCookie = v.headers['set-cookie'] as unknown as string[];
    const csrf = await request(s)
      .get('/auth/csrf')
      .set('Cookie', sessionCookie)
      .expect(200);
    const cookies = sessionCookie.concat(
      csrf.headers['set-cookie'] as unknown as string[],
    );
    return { s, cookies, csrf: csrf.body.csrfToken as string };
  }

  it('patients : CRUD + ownership cross-user', async () => {
    const a = await authedClient();

    // A creates a patient
    const created = await request(a.s)
      .post('/patients')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ firstName: 'Jean', lastName: 'Dupont', birthDate: '1990-01-01' })
      .expect(201);
    const id = created.body.id;
    expect(id).toBeTruthy();

    // A can list their own patient
    const list = await request(a.s)
      .get('/patients')
      .set('Cookie', a.cookies)
      .expect(200);
    expect(
      list.body.some((x: unknown) => (x as { id: string }).id === id),
    ).toBe(true);

    // B cannot see A's patient nor update it
    const b = await authedClient();
    const otherList = await request(a.s)
      .get('/patients')
      .set('Cookie', b.cookies)
      .expect(200);
    expect(
      otherList.body.some((x: unknown) => (x as { id: string }).id === id),
    ).toBe(false);
    await request(a.s)
      .put(`/patients/${id}`)
      .set('Cookie', b.cookies)
      .set('X-CSRF-Token', b.csrf)
      .send({ firstName: 'Hack', lastName: 'Hack', birthDate: '1990-01-01' })
      .expect(404);

    // A deletes their patient
    await request(a.s)
      .delete(`/patients/${id}`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(204);
  });

  it('appointments : create + status transition', async () => {
    const a = await authedClient();

    // Create a patient
    const patient = await request(a.s)
      .post('/patients')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ firstName: 'Marie', lastName: 'Curie', birthDate: '1867-11-07' })
      .expect(201);
    const patientId = patient.body.id;
    expect(patientId).toBeTruthy();

    // Create a practitioner
    const practitioner = await request(a.s)
      .post('/practitioners')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Dr X', type: 'generaliste' })
      .expect(201);
    const practitionerId = practitioner.body.id;
    expect(practitionerId).toBeTruthy();

    // Create an appointment
    const appt = await request(a.s)
      .post('/appointments')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ patientId, practitionerId, date: '2026-06-01', time: '10:00' })
      .expect(201);
    const apptId = appt.body.id;
    expect(apptId).toBeTruthy();
    expect(appt.body.status).toBe('scheduled');

    // Transition status to completed
    const updated = await request(a.s)
      .patch(`/appointments/${apptId}/status`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ status: 'completed' })
      .expect(200);
    expect(updated.body.status).toBe('completed');
  });

  it('mutation sans X-CSRF-Token → 403', async () => {
    const a = await authedClient();
    await request(a.s)
      .post('/patients')
      .set('Cookie', a.cookies)
      .send({ firstName: 'NoCsrf', lastName: 'Test', birthDate: '2000-01-01' })
      .expect(403);
  });

  it('members : supprimer un membre qui a un dossier médical → 409 avec compteurs, puis ?force=true → 204 et cascade', async () => {
    const a = await authedClient();
    const member = await request(a.s)
      .post('/members')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ firstName: 'Léa' })
      .expect(201);
    const practitioner = await request(a.s)
      .post('/practitioners')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Dr Y', type: 'pediatre' })
      .expect(201);
    await request(a.s)
      .post('/appointments')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        patientId: member.body.id,
        practitionerId: practitioner.body.id,
        date: '2026-10-01',
        time: '09:00',
      })
      .expect(201);

    const refused = await request(a.s)
      .delete(`/members/${member.body.id}`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(409);
    expect(refused.body.code).toBe('MEMBER_HAS_MEDICAL_DATA');
    expect(refused.body.details).toEqual({
      appointments: 1,
      prescriptions: 0,
      medications: 0,
      documents: 0,
    });
    // Toujours là.
    const still = await request(a.s)
      .get('/members')
      .set('Cookie', a.cookies)
      .expect(200);
    expect(still.body.map((m: { id: string }) => m.id)).toContain(
      member.body.id,
    );

    await request(a.s)
      .delete(`/members/${member.body.id}?force=true`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(204);
    const appts = await request(a.s)
      .get('/appointments')
      .set('Cookie', a.cookies)
      .expect(200);
    expect(appts.body).toHaveLength(0);
  });

  it('members : sans dossier médical, DELETE direct → 204 (pas de friction inutile)', async () => {
    const a = await authedClient();
    const member = await request(a.s)
      .post('/members')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ firstName: 'Tom' })
      .expect(201);
    await request(a.s)
      .delete(`/members/${member.body.id}`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(204);
  });

  it('reminders : cible incohérente (target=medication sans medicationId) → 400', async () => {
    const a = await authedClient();
    await request(a.s)
      .post('/reminders')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        type: 'ical',
        target: 'medication',
        recipientEmail: 'x@dashflow.test',
      })
      .expect(400);
  });

  it('medications : refill atomique et scopé (cross-user → 404) ; alerts exclut les lignes E2EE', async () => {
    const a = await authedClient();
    const patient = await request(a.s)
      .post('/patients')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ firstName: 'Zoé', lastName: 'M', birthDate: '2015-05-05' })
      .expect(201);
    const med = await request(a.s)
      .post('/medications')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        patientId: patient.body.id,
        name: 'Doliprane',
        type: 'comprime',
        dosage: '500 mg',
        quantity: 2,
        dailyRate: '1',
        startDate: '2026-09-01',
        alertDaysBefore: 7,
      })
      .expect(201);

    // Deux réassorts concurrents s'additionnent (UPDATE … SET quantity = quantity + n).
    await Promise.all([
      request(a.s)
        .patch(`/medications/${med.body.id}/refill`)
        .set('Cookie', a.cookies)
        .set('X-CSRF-Token', a.csrf)
        .send({ quantity: 10 })
        .expect(200),
      request(a.s)
        .patch(`/medications/${med.body.id}/refill`)
        .set('Cookie', a.cookies)
        .set('X-CSRF-Token', a.csrf)
        .send({ quantity: 20 })
        .expect(200),
    ]);
    const after = await request(a.s)
      .get(`/medications/${med.body.id}`)
      .set('Cookie', a.cookies)
      .expect(200);
    expect(after.body.quantity).toBe(32);

    // Un autre utilisateur ne peut pas réassortir ce médicament (avant : lu par id seul).
    const b = await authedClient();
    await request(b.s)
      .patch(`/medications/${med.body.id}/refill`)
      .set('Cookie', b.cookies)
      .set('X-CSRF-Token', b.csrf)
      .send({ quantity: 1 })
      .expect(404);

    // Alerts : ligne E2EE (placeholders) exclue ; ligne en clair presque à sec incluse.
    await request(a.s)
      .post('/medications')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        patientId: patient.body.id,
        encryptedData: 'v2.blob',
        id: crypto.randomUUID(),
      })
      .expect(201);
    const low = await request(a.s)
      .post('/medications')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        patientId: patient.body.id,
        name: 'Presque vide',
        type: 'comprime',
        dosage: '1',
        quantity: 1,
        dailyRate: '1',
        startDate: '2020-01-01',
        alertDaysBefore: 7,
      })
      .expect(201);
    const alerts = await request(a.s)
      .get('/medications/alerts')
      .set('Cookie', a.cookies)
      .expect(200);
    const ids = alerts.body.map((m: { id: string }) => m.id);
    expect(ids).toContain(low.body.id);
    expect(
      alerts.body.every(
        (m: { encryptedData: string | null }) => !m.encryptedData,
      ),
    ).toBe(true);
    const lowRow = alerts.body.find(
      (m: { id: string }) => m.id === low.body.id,
    );
    expect(lowRow.isLow).toBe(true);
    expect(lowRow.remainingQuantity).toBe(0);
    expect(lowRow.runOutDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
