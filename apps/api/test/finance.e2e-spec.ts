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
    expect(
      list.body.some((x: unknown) => (x as { id: string }).id === id),
    ).toBe(true);

    // second user cannot touch the first user's account
    const b = await authedClient();
    const otherList = await request(a.s)
      .get('/bank-accounts')
      .set('Cookie', b.cookies)
      .expect(200);
    expect(
      otherList.body.some((x: unknown) => (x as { id: string }).id === id),
    ).toBe(false);
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

  it('loans : un paiement supérieur au restant dû est refusé (400) et rien ne bouge', async () => {
    const a = await authedClient();
    const loan = await request(a.s)
      .post('/loans')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        person: 'Sophie',
        direction: 'lent',
        amount: '100',
        remaining: '50',
        date: '2026-01-01',
      })
      .expect(201);
    const id = loan.body.id as string;

    await request(a.s)
      .patch(`/loans/${id}/payment`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ amount: 80 })
      .expect(400);

    const after = await request(a.s)
      .get(`/loans/${id}`)
      .set('Cookie', a.cookies)
      .expect(200);
    expect(after.body.remaining).toBe('50.00');
    const tx = await request(a.s)
      .get(`/loans/${id}/transactions`)
      .set('Cookie', a.cookies)
      .expect(200);
    expect(tx.body).toHaveLength(0);
  });

  it('loans : remaining > amount refusé à la création (400)', async () => {
    const a = await authedClient();
    await request(a.s)
      .post('/loans')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        person: 'Sophie',
        direction: 'lent',
        amount: '100',
        remaining: '150',
        date: '2026-01-01',
      })
      .expect(400);
  });

  it('account-transactions : montant négatif ou NaN → 400 (le sens est porté par direction)', async () => {
    const a = await authedClient();
    const acc = await request(a.s)
      .post('/bank-accounts')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Courant', initialBalance: 0 })
      .expect(201);
    for (const amount of ['-10', 'NaN', 'Infinity', '1.005']) {
      await request(a.s)
        .post(`/bank-accounts/${acc.body.id}/transactions`)
        .set('Cookie', a.cookies)
        .set('X-CSRF-Token', a.csrf)
        .send({ amount, direction: 'expense', date: '2026-03-01' })
        .expect(400);
    }
  });

  it('envelopes : deux crédits concurrents ne se perdent pas (verrou de ligne)', async () => {
    const a = await authedClient();
    const env = await request(a.s)
      .post('/envelopes')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Concurrence', type: 'épargne', balance: '0' })
      .expect(201);
    const id = env.body.id as string;

    const credit = (amount: number) =>
      request(a.s)
        .patch(`/envelopes/${id}/balance`)
        .set('Cookie', a.cookies)
        .set('X-CSRF-Token', a.csrf)
        .send({ amount })
        .expect(200);
    await Promise.all([credit(10), credit(20), credit(0.3)]);

    const after = await request(a.s)
      .get(`/envelopes/${id}`)
      .set('Cookie', a.cookies)
      .expect(200);
    expect(after.body.balance).toBe('30.30');
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
