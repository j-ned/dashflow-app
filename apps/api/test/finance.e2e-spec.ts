import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/mail/mailer';
import { authKey } from './auth-key';

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
      .send({ email, password: authKey('motdepasse-long-12') })
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

  // Les tests ci-dessous partagent une session : /auth/register est throttlé par IP et la suite
  // en consomme déjà plusieurs.
  let sharedClient: Awaited<ReturnType<typeof authedClient>> | undefined;
  async function shared() {
    sharedClient ??= await authedClient();
    return sharedClient;
  }

  it('transactions : pagination par curseur — X-Next-Cursor, ordre stable, aucune ligne perdue ni doublée', async () => {
    const a = await shared();
    const acc = await request(a.s)
      .post('/bank-accounts')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Pagination', initialBalance: 0 })
      .expect(201);
    // 5 lignes en un seul INSERT (même created_at à la microseconde près : le cas piège).
    const items = [1, 2, 3, 4, 5].map((i) => ({
      amount: String(i),
      direction: 'expense',
      date: '2026-09-01',
      note: `n${i}`,
    }));
    await request(a.s)
      .post(`/bank-accounts/${acc.body.id}/transactions/batch`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ items })
      .expect(201);

    const seen: string[] = [];
    let after: string | undefined;
    let pages = 0;
    do {
      const q = after
        ? `?limit=2&after=${encodeURIComponent(after)}`
        : '?limit=2';
      const res = await request(a.s)
        .get(`/transactions/all${q}`)
        .set('Cookie', a.cookies)
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeLessThanOrEqual(2);
      for (const row of res.body) {
        expect(row._cursor).toBeUndefined(); // colonne technique jamais exposée
        seen.push(row.id);
      }
      after = res.headers['x-next-cursor'];
      pages++;
    } while (after && pages < 10);
    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(5);

    // Sans paramètre : tout d'un coup (≤ 500), pas d'en-tête de suite.
    const all = await request(a.s)
      .get('/transactions/all')
      .set('Cookie', a.cookies)
      .expect(200);
    expect(all.body).toHaveLength(5);
    expect(all.headers['x-next-cursor']).toBeUndefined();

    // Curseur forgé → 400, pas 500.
    await request(a.s)
      .get('/transactions/all?after=zzz')
      .set('Cookie', a.cookies)
      .expect(400);
  });

  it("transactions : virement vers le compte d'origine → 400", async () => {
    const a = await shared();
    const acc = await request(a.s)
      .post('/bank-accounts')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ name: 'Self', initialBalance: 0 })
      .expect(201);
    await request(a.s)
      .post(`/bank-accounts/${acc.body.id}/transactions`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        amount: '10',
        direction: 'transfer',
        date: '2026-09-01',
        toAccountId: acc.body.id,
      })
      .expect(400);
  });

  it('id non-UUID sur une route CRUD → 400 (plus de 500 remonté à Sentry)', async () => {
    const a = await shared();
    await request(a.s)
      .get('/envelopes/abc')
      .set('Cookie', a.cookies)
      .expect(400);
    await request(a.s)
      .delete('/transactions/abc')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .expect(400);
  });

  it('recurring-entries : endDate < date refusé à la création (400) et par la base en update partiel (400 CHECK_VIOLATION)', async () => {
    const a = await shared();
    await request(a.s)
      .post('/recurring-entries')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        label: 'Abonnement',
        amount: '9.99',
        type: 'expense',
        dayOfMonth: 5,
        date: '2026-09-01',
        endDate: '2026-08-01',
      })
      .expect(400);

    const created = await request(a.s)
      .post('/recurring-entries')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        label: 'Abonnement',
        amount: '9.99',
        type: 'expense',
        dayOfMonth: 5,
        date: '2026-09-01',
      })
      .expect(201);
    // Update partiel : Zod ne voit que endDate, c'est la contrainte CHECK qui tranche → mappée 400.
    const res = await request(a.s)
      .put(`/recurring-entries/${created.body.id}`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ endDate: '2026-01-01' })
      .expect(400);
    expect(res.body.code).toBe('CHECK_VIOLATION');
  });

  it("E2EE : le client peut fixer l'id de la ligne créée (liaison blob ↔ ligne) ; doublon → 409 ; ignoré en clair", async () => {
    const a = await shared();
    const id = crypto.randomUUID();
    const created = await request(a.s)
      .post('/envelopes')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ id, encryptedData: 'v2.blob', type: 'épargne' })
      .expect(201);
    expect(created.body.id).toBe(id);

    const dup = await request(a.s)
      .post('/envelopes')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ id, encryptedData: 'v2.autre', type: 'épargne' })
      .expect(409);
    expect(dup.body.code).toBe('UNIQUE_VIOLATION');

    // Hors E2EE l'id client est ignoré : le serveur génère.
    const plainId = crypto.randomUUID();
    const plain = await request(a.s)
      .post('/envelopes')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ id: plainId, name: 'Clair', type: 'épargne', balance: '0' })
      .expect(201);
    expect(plain.body.id).not.toBe(plainId);

    // Transactions de compte : id client accepté aussi en batch.
    const acc = await request(a.s)
      .post('/bank-accounts')
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({ encryptedData: 'v2.acc', id: crypto.randomUUID() })
      .expect(201);
    const t1 = crypto.randomUUID();
    const t2 = crypto.randomUUID();
    const batch = await request(a.s)
      .post(`/bank-accounts/${acc.body.id}/transactions/batch`)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', a.csrf)
      .send({
        items: [
          { id: t1, encryptedData: 'v2.t1', direction: 'expense' },
          { id: t2, encryptedData: 'v2.t2', direction: 'income' },
        ],
      })
      .expect(201);
    expect(batch.body.map((r: { id: string }) => r.id).sort()).toEqual(
      [t1, t2].sort(),
    );
  });
});
