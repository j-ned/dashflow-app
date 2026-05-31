import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/mail/mailer';

class CapturingMailer implements Mailer {
  lastCode = '';
  async sendVerificationCode(_to: string, code: string) { this.lastCode = code; }
  async sendPasswordResetCode(_to: string, code: string) { this.lastCode = code; }
  async sendCalendarInvitation(_to: string, _senderName: string, _calendarToken: string) { /* no-op */ }
}

describe('Transverse e2e', () => {
  let app: INestApplication;
  const mailer = new CapturingMailer();

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER).useValue(mailer).compile();
    app = m.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => { await app.close(); });

  async function authedClient() {
    const s = app.getHttpServer();
    const email = `trans+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
    await request(s).post('/api/auth/register').send({ email, password: 'motdepasse-long-12' }).expect(201);
    const v = await request(s).post('/api/auth/verify').send({ email, code: mailer.lastCode }).expect(200);
    const sessionCookie = v.headers['set-cookie'] as unknown as string[];
    const csrf = await request(s).get('/api/auth/csrf').set('Cookie', sessionCookie).expect(200);
    const cookies = sessionCookie.concat(csrf.headers['set-cookie'] as unknown as string[]);
    return { s, cookies, csrf: csrf.body.csrfToken as string };
  }

  it('reminders : CRUD + toggle', async () => {
    const a = await authedClient();

    // Create a reminder
    const created = await request(a.s).post('/api/reminders')
      .set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf)
      .send({ type: 'email', target: 'appointment', recipientEmail: 'x@y.com' })
      .expect(201);
    const id = created.body.id;
    expect(id).toBeTruthy();
    expect(created.body.enabled).toBe(true);

    // Toggle disables the reminder
    const toggled = await request(a.s).patch(`/api/reminders/${id}/toggle`)
      .set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf)
      .expect(200);
    expect(toggled.body.enabled).toBe(false);

    // GET list contains the id
    const list = await request(a.s).get('/api/reminders').set('Cookie', a.cookies).expect(200);
    expect(list.body.some((x: unknown) => (x as { id: string }).id === id)).toBe(true);

    // DELETE the reminder
    await request(a.s).delete(`/api/reminders/${id}`)
      .set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf)
      .expect(204);
  });

  it('shared-access → public calendar', async () => {
    const a = await authedClient();

    // Create shared access — returns the inserted row including calendarToken
    const created = await request(a.s).post('/api/shared-access')
      .set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf)
      .send({ invitedEmail: 'a@b.com' })
      .expect(201);
    const calendarToken = created.body.calendarToken as string;
    expect(calendarToken).toBeTruthy();

    // Public GET — no cookie, proves no auth required
    const cal = await request(a.s)
      .get(`/api/medical/calendar/${calendarToken}`)
      .expect(200);
    expect(cal.headers['content-type']).toContain('text/calendar');
    expect(cal.text).toContain('BEGIN:VCALENDAR');
  });

  it('calendar unknown token → 404', async () => {
    const s = app.getHttpServer();
    await request(s).get('/api/medical/calendar/nope').expect(404);
  });
});
