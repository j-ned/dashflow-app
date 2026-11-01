import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startApi, type E2eApi } from './e2e/api-server';
import { authKey } from './auth-key';

describe('Transverse e2e', () => {
  let api: E2eApi;

  beforeAll(async () => {
    api = await startApi();
  });
  afterAll(async () => {
    await api?.stop();
  });

  async function authedClient() {
    const s = api.url;
    const email = `trans+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
    await request(s)
      .post('/auth/register')
      .send({ email, password: authKey('motdepasse-long-12') })
      .expect(201);
    const v = await request(s)
      .post('/auth/verify')
      .send({ email, code: api.mail.lastCode })
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

  it('reminders : CRUD + toggle', async () => {
    const a = await authedClient();

    // Un rappel pointe toujours sur sa cible (le formulaire front l'impose, la base aussi).
    const patient = await request(a.s)
      .post('/patients')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ firstName: 'Ada', lastName: 'L', birthDate: '1815-12-10' })
      .expect(201);
    const practitioner = await request(a.s)
      .post('/practitioners')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Dr Z', type: 'generaliste' })
      .expect(201);
    const appt = await request(a.s)
      .post('/appointments')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        patientId: patient.body.id,
        practitionerId: practitioner.body.id,
        date: '2026-11-02',
        time: '14:00',
      })
      .expect(201);

    // Create a reminder
    const created = await request(a.s)
      .post('/reminders')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      // `type` / `recipientEmail` : encore envoyés par un front antérieur, ignorés et jamais stockés.
      .send({
        type: 'email',
        target: 'appointment',
        appointmentId: appt.body.id,
        recipientEmail: 'x@y.com',
      })
      .expect(201);
    const id = created.body.id;
    expect(id).toBeTruthy();
    expect(created.body.enabled).toBe(true);
    expect(created.body).not.toHaveProperty('recipientEmail');
    expect(created.body).not.toHaveProperty('type');

    // Toggle disables the reminder
    const toggled = await request(a.s)
      .patch(`/reminders/${id}/toggle`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(200);
    expect(toggled.body.enabled).toBe(false);

    // GET list contains the id
    const list = await request(a.s)
      .get('/reminders')
      .set('Cookie', a.cookies)
      .expect(200);
    expect(
      list.body.some((x: unknown) => (x as { id: string }).id === id),
    ).toBe(true);

    // DELETE the reminder
    await request(a.s)
      .delete(`/reminders/${id}`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(204);
  });
});
