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

describe('Finance e2e', () => {
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
    const email = `fin+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
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

  it('bank-accounts : CRUD + ownership cross-user', async () => {
    const a = await authedClient();
    const created = await request(a.s)
      .post('/bank-accounts')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Courant', initialBalance: 100 })
      .expect(201);
    const id = created.body.id;
    expect(id).toBeTruthy();

    const list = await request(a.s)
      .get('/bank-accounts')
      .set('Cookie', a.cookies)
      .expect(200);
    expect(list.body.some((x: any) => x.id === id)).toBe(true);

    // second user cannot touch the first user's account
    const b = await authedClient();
    const otherList = await request(a.s)
      .get('/bank-accounts')
      .set('Cookie', b.cookies)
      .expect(200);
    expect(otherList.body.some((x: any) => x.id === id)).toBe(false);
    await request(a.s)
      .put(`/bank-accounts/${id}`)
      .set('Cookie', b.cookies)
      .set('X-CSRF-Token', b.csrf)
      .send({ name: 'Hack' })
      .expect(404);

    await request(a.s)
      .delete(`/bank-accounts/${id}`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(204);
  });

  it('envelopes : transaction + balance credit', async () => {
    const a = await authedClient();
    const env = await request(a.s)
      .post('/envelopes')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Vacances', type: 'vacances' })
      .expect(201);
    const id = env.body.id;

    await request(a.s)
      .patch(`/envelopes/${id}/balance`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ amount: 10 })
      .expect(200);

    const tx = await request(a.s)
      .get(`/envelopes/${id}/transactions`)
      .set('Cookie', a.cookies)
      .expect(200);
    expect(tx.body.length).toBeGreaterThanOrEqual(1);
  });

  it('mutation sans X-CSRF-Token → 403', async () => {
    const a = await authedClient();
    await request(a.s)
      .post('/bank-accounts')
      .set('Cookie', a.cookies)
      .send({ name: 'NoCsrf', initialBalance: 0 })
      .expect(403);
  });
});
