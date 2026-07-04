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
  async sendCalendarInvitation(
    _to: string,
    _senderName: string,
    _calendarToken: string,
  ) {
    /* no-op */
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
});
