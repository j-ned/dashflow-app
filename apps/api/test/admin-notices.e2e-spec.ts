import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import postgres from 'postgres';
import { AppModule } from '../src/app.module';
import { AdminService } from '../src/modules/admin/admin.service';
import { MAILER, type Mailer } from '../src/mail/mailer';
import type { NoticeReason } from '../src/modules/admin/account-security';
import { authKey } from './auth-key';

class CapturingMailer implements Mailer {
  lastCode = '';
  notices: { to: string; reason: NoticeReason }[] = [];
  sendVerificationCode(_to: string, code: string): Promise<void> {
    this.lastCode = code;
    return Promise.resolve();
  }
  sendPasswordResetCode(_to: string, code: string): Promise<void> {
    this.lastCode = code;
    return Promise.resolve();
  }
  sendAccountExists(): Promise<void> {
    return Promise.resolve();
  }
  sendSecurityNotice(to: string, reason: NoticeReason): Promise<void> {
    this.notices.push({ to, reason });
    return Promise.resolve();
  }
}

// Application dédiée : les compteurs de throttling (par IP et par route) sont en mémoire, par app.
describe('Admin notices e2e', () => {
  let app: INestApplication;
  const mailer = new CapturingMailer();
  const sql = postgres(process.env.DATABASE_URL!);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await sql.end();
    await app.close();
  });

  async function client(tag: string) {
    const s = app.getHttpServer();
    const email = `${tag}+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
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
    const [{ id }] = await sql<
      { id: string }[]
    >`select id from users where email = ${email}`;
    return {
      s,
      id,
      email,
      cookies: sessionCookie.concat(
        csrf.headers['set-cookie'] as unknown as string[],
      ),
      csrf: csrf.body.csrfToken as string,
    };
  }

  it('relance « reconnect » : réservée aux admins, ciblée, tracée, ferme la session, puis délai de 7 jours', async () => {
    const admin = await client('adm');
    const target = await client('old');
    const upToDate = await client('ok');
    await sql`update users set role = 'admin' where id = ${admin.id}`;
    // Compte d'avant la clé dérivée : c'est lui, et lui seul, que le motif « reconnect » vise.
    await sql`update users set auth_version = 0 where id = ${target.id}`;

    // Un utilisateur ordinaire n'a accès ni à la liste ni à l'envoi.
    await request(target.s)
      .post('/admin/notices')
      .set('Cookie', target.cookies)
      .set('X-CSRF-Token', target.csrf)
      .send({ reason: 'reconnect' })
      .expect(403);

    // Sans jeton CSRF, même l'admin est refusé.
    await request(admin.s)
      .post('/admin/notices')
      .set('Cookie', admin.cookies)
      .send({ reason: 'reconnect' })
      .expect(403);

    // La liste porte la pastille.
    const list = await request(admin.s)
      .get('/admin/users')
      .query({ search: target.email })
      .set('Cookie', admin.cookies)
      .expect(200);
    expect(list.body.items[0].security.status).toBe('action');
    expect(list.body.items[0].security.issues).toContainEqual({
      reason: 'reconnect',
      severity: 'action',
    });
    expect(JSON.stringify(list.body)).not.toMatch(
      /wrapped|password|totp_secret|salt/i,
    );

    // Envoi sélectif : le compte à jour coché par erreur est ignoré, avec la raison.
    mailer.notices = [];
    const sent = await request(admin.s)
      .post('/admin/notices')
      .set('Cookie', admin.cookies)
      .set('X-CSRF-Token', admin.csrf)
      .send({ reason: 'reconnect', userIds: [target.id, upToDate.id] })
      .expect(200);
    expect(sent.body.sent).toEqual([{ id: target.id, email: target.email }]);
    expect(sent.body.skipped).toEqual([
      { id: upToDate.id, email: upToDate.email, why: 'not_eligible' },
    ]);
    expect(mailer.notices).toEqual([{ to: target.email, reason: 'reconnect' }]);

    // La session du compte relancé est fermée, celle du compte à jour ne l'est pas.
    await request(target.s)
      .get('/auth/me')
      .set('Cookie', target.cookies)
      .expect(401);
    await request(upToDate.s)
      .get('/auth/me')
      .set('Cookie', upToDate.cookies)
      .expect(200);

    // La relance apparaît dans le journal du compte, sans l'IP de l'administrateur.
    const events = await sql<{ type: string; ip: string | null }[]>`
      select type, ip from security_events where user_id = ${target.id} and type like 'admin\\_notice\\_%'`;
    expect(events).toEqual([{ type: 'admin_notice_reconnect', ip: null }]);

    // Second envoi au même compte : le délai de 7 jours bloque, aucun mail ne repart.
    // (Sélectif exprès : un envoi groupé « reconnect » fermerait la session des comptes créés par
    // les autres suites e2e, qui tournent sur la même base. Le chemin groupé est couvert en unitaire.)
    mailer.notices = [];
    const again = await request(admin.s)
      .post('/admin/notices')
      .set('Cookie', admin.cookies)
      .set('X-CSRF-Token', admin.csrf)
      .send({ reason: 'reconnect', userIds: [target.id] })
      .expect(200);
    expect(again.body.sent).toEqual([]);
    expect(again.body.skipped).toEqual([
      { id: target.id, email: target.email, why: 'cooldown' },
    ]);
    expect(mailer.notices).toEqual([]);

    const summary = await request(admin.s)
      .get('/admin/notices/summary')
      .set('Cookie', admin.cookies)
      .expect(200);
    expect(summary.body.reconnect.eligible).toBeGreaterThanOrEqual(1);
    expect(summary.body.reconnect.onCooldown).toBeGreaterThanOrEqual(1);

    // Un texte libre ou un motif inconnu est refusé.
    await request(admin.s)
      .post('/admin/notices')
      .set('Cookie', admin.cookies)
      .set('X-CSRF-Token', admin.csrf)
      .send({ reason: 'promo', message: 'cliquez ici' })
      .expect(400);
  });

  it('faux comptes : jamais relancés, supprimables par l’admin — et seulement eux', async () => {
    const admin = await client('adm2');
    const real = await client('real');
    await sql`update users set role = 'admin' where id = ${admin.id}`;
    // Inscription jamais confirmée : la ligne existe, l'e-mail n'a pas été vérifié.
    const fakeEmail = `jean+${Date.now()}@dashflow.test`;
    await request(admin.s)
      .post('/auth/register')
      .send({ email: fakeEmail, password: authKey('motdepasse-long-12') })
      .expect(201);
    const [{ id: fakeId }] = await sql<
      { id: string }[]
    >`select id from users where email = ${fakeEmail}`;

    const list = await request(admin.s)
      .get('/admin/users')
      .query({ search: fakeEmail })
      .set('Cookie', admin.cookies)
      .expect(200);
    expect(list.body.items[0].security).toEqual({
      status: 'unverified',
      issues: [],
    });

    // Aucune relance ne part vers une adresse non vérifiée, même cochée.
    mailer.notices = [];
    const notice = await request(admin.s)
      .post('/admin/notices')
      .set('Cookie', admin.cookies)
      .set('X-CSRF-Token', admin.csrf)
      .send({ reason: 'enable_encryption', userIds: [fakeId] })
      .expect(200);
    expect(notice.body.sent).toEqual([]);
    expect(mailer.notices).toEqual([]);

    // Un utilisateur ordinaire ne supprime personne.
    await request(real.s)
      .post('/admin/users/delete-unverified')
      .set('Cookie', real.cookies)
      .set('X-CSRF-Token', real.csrf)
      .send({ userIds: [fakeId] })
      .expect(403);

    // L'admin supprime le faux compte ; le vrai compte et le sien sont refusés.
    const del = await request(admin.s)
      .post('/admin/users/delete-unverified')
      .set('Cookie', admin.cookies)
      .set('X-CSRF-Token', admin.csrf)
      .send({ userIds: [fakeId, real.id, admin.id] })
      .expect(200);
    expect(del.body.deleted).toEqual([{ id: fakeId, email: fakeEmail }]);
    expect(del.body.skipped).toEqual([
      { id: real.id, email: real.email, why: 'verified' },
      { id: admin.id, email: admin.email, why: 'self' },
    ]);
    const left =
      await sql`select id from users where id in ${sql([fakeId, real.id, admin.id])}`;
    expect(left.map((r) => r.id).sort()).toEqual([real.id, admin.id].sort());
    const codes =
      await sql`select 1 from verification_codes where email = ${fakeEmail}`;
    expect(codes).toHaveLength(0);
    await request(real.s)
      .get('/auth/me')
      .set('Cookie', real.cookies)
      .expect(200);
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

    await app.get(AdminService).purgeStaleUnverified();

    const left = await sql<
      { email: string }[]
    >`select email from users where email in ${sql([old, recent, retrying, verified])}`;
    expect(left.map((r) => r.email).sort()).toEqual(
      [recent, retrying, verified].sort(),
    );
  });
});
