import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import * as OTPAuth from 'otpauth';
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

describe('Auth e2e', () => {
  let app: INestApplication;
  const mailer = new CapturingMailer();
  const email = `e2e+${Date.now()}@dashflow.test`;

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
    await app.close();
  });

  it('register → verify → cookie → GET /me', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(201);

    const verify = await request(app.getHttpServer())
      .post('/auth/verify')
      .send({ email, code: mailer.lastCode })
      .expect(200);

    const cookie = verify.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];
    expect(cookieArr.join(';')).toContain('dashflow_session');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieArr)
      .expect(200);

    expect(me.body.email).toBe(email);
    expect(me.body.hasPassword).toBe(true);
    expect(me.body.password).toBeUndefined();
  });

  it('pre-account-takeover : le mot de passe du premier inscrit (non vérifié) est invalidé par la seconde inscription', async () => {
    const server = app.getHttpServer();
    const victim = `e2e-pat+${Date.now()}@dashflow.test`;

    // 1. L'attaquant « réserve » l'e-mail de la victime avec SON mot de passe, sans le vérifier.
    await request(server)
      .post('/auth/register')
      .send({ email: victim, password: 'mot-de-passe-attaquant' })
      .expect(201);

    // 2. La vraie personne s'inscrit à son tour et vérifie l'e-mail.
    await request(server)
      .post('/auth/register')
      .send({ email: victim, password: 'mot-de-passe-victime-12' })
      .expect(201);
    await request(server)
      .post('/auth/verify')
      .send({ email: victim, code: mailer.lastCode })
      .expect(200);

    // 3. Seul le mot de passe de la personne qui a prouvé l'e-mail fonctionne.
    await request(server)
      .post('/auth/login')
      .send({ email: victim, password: 'mot-de-passe-attaquant' })
      .expect(401);
    await request(server)
      .post('/auth/login')
      .send({ email: victim, password: 'mot-de-passe-victime-12' })
      .expect(200);
  });

  it('logout révoque réellement la session : l’ancien cookie renvoie 401 sur GET /me', async () => {
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(200);
    const cookie = login.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];
    const csrf = await request(server)
      .get('/auth/csrf')
      .set('Cookie', cookieArr)
      .expect(200);
    const csrfCookie = csrf.headers['set-cookie'] as string | string[];
    const all = cookieArr.concat(
      Array.isArray(csrfCookie) ? csrfCookie : [csrfCookie],
    );

    await request(server).get('/auth/me').set('Cookie', all).expect(200);
    await request(server)
      .post('/auth/logout')
      .set('Cookie', all)
      .set('X-CSRF-Token', csrf.body.csrfToken as string)
      .expect(200);
    // Le cookie n'est pas seulement effacé côté client : un attaquant qui l'aurait copié est bloqué.
    await request(server).get('/auth/me').set('Cookie', all).expect(401);
  });

  it('changement de mot de passe : l’ancien cookie est révoqué, la réponse porte un cookie à jour', async () => {
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(200);
    const cookie = login.headers['set-cookie'] as string | string[];
    const oldCookie = Array.isArray(cookie) ? cookie : [cookie];
    const csrf = await request(server)
      .get('/auth/csrf')
      .set('Cookie', oldCookie)
      .expect(200);
    const csrfCookie = csrf.headers['set-cookie'] as string | string[];
    const all = oldCookie.concat(
      Array.isArray(csrfCookie) ? csrfCookie : [csrfCookie],
    );

    const changed = await request(server)
      .patch('/auth/me/password')
      .set('Cookie', all)
      .set('X-CSRF-Token', csrf.body.csrfToken as string)
      .send({
        currentPassword: 'motdepasse-long-12',
        newPassword: 'motdepasse-long-13',
      })
      .expect(200);
    const fresh = changed.headers['set-cookie'] as string | string[];
    const freshArr = Array.isArray(fresh) ? fresh : [fresh];
    expect(freshArr.join(';')).toContain('dashflow_session');

    await request(server).get('/auth/me').set('Cookie', all).expect(401);
    await request(server).get('/auth/me').set('Cookie', freshArr).expect(200);

    // Remet le mot de passe d'origine pour les tests suivants.
    const csrf2 = await request(server)
      .get('/auth/csrf')
      .set('Cookie', freshArr)
      .expect(200);
    const csrfCookie2 = csrf2.headers['set-cookie'] as string | string[];
    await request(server)
      .patch('/auth/me/password')
      .set(
        'Cookie',
        freshArr.concat(
          Array.isArray(csrfCookie2) ? csrfCookie2 : [csrfCookie2],
        ),
      )
      .set('X-CSRF-Token', csrf2.body.csrfToken as string)
      .send({
        currentPassword: 'motdepasse-long-13',
        newPassword: 'motdepasse-long-12',
      })
      .expect(200);
  });

  it('code OTP : détruit après 5 échecs, même le bon code ne passe plus', async () => {
    const server = app.getHttpServer();
    const target = `e2e-otp+${Date.now()}@dashflow.test`;
    await request(server)
      .post('/auth/register')
      .send({ email: target, password: 'motdepasse-long-12' })
      .expect(201);
    const good = mailer.lastCode;
    const wrong = good === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      await request(server)
        .post('/auth/verify')
        .send({ email: target, code: wrong })
        .expect(400);
    }
    await request(server)
      .post('/auth/verify')
      .send({ email: target, code: good })
      .expect(400);
  });

  it('login mauvais mot de passe → 401', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'mauvais' })
      .expect(401);
  });

  it('mutation authentifiée sans CSRF → 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(200);

    const loginCookie = login.headers['set-cookie'] as string | string[];
    const loginCookieArr = Array.isArray(loginCookie)
      ? loginCookie
      : [loginCookie];

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', loginCookieArr)
      .expect(403);
  });

  it('2FA : setup → enable → login exige le code', async () => {
    const email2 = `e2e2fa+${Date.now()}@dashflow.test`;
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email: email2, password: 'motdepasse-long-12' })
      .expect(201);
    const verify = await request(server)
      .post('/auth/verify')
      .send({ email: email2, code: mailer.lastCode })
      .expect(200);
    const cookie = verify.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];

    const csrf = await request(server)
      .get('/auth/csrf')
      .set('Cookie', cookieArr)
      .expect(200);
    const csrfCookie = csrf.headers['set-cookie'] as string | string[];
    const allCookies = cookieArr.concat(
      Array.isArray(csrfCookie) ? csrfCookie : [csrfCookie],
    );
    const csrfToken = csrf.body.csrfToken as string;

    const setup = await request(server)
      .post('/auth/me/2fa/setup')
      .set('Cookie', allCookies)
      .set('X-CSRF-Token', csrfToken)
      .expect(200);
    const secret = setup.body.secret as string;
    const totp = new OTPAuth.TOTP({
      issuer: 'DashFlow',
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const enabled = await request(server)
      .post('/auth/me/2fa/verify')
      .set('Cookie', allCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ code: totp.generate() })
      .expect(200);
    const backupCodes = enabled.body.backupCodes as string[];
    expect(backupCodes).toHaveLength(10);
    for (const c of backupCodes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);

    const status = await request(server)
      .get('/auth/me/2fa/backup-codes')
      .set('Cookie', allCookies)
      .expect(200);
    expect(status.body.remaining).toBe(10);

    const noCode = await request(server)
      .post('/auth/login')
      .send({ email: email2, password: 'motdepasse-long-12' })
      .expect(200);
    expect(noCode.body.mfaRequired).toBe(true);
    await request(server)
      .post('/auth/login')
      .send({
        email: email2,
        password: 'motdepasse-long-12',
        // Anti-rejeu : le code utilisé pour l'enrôlement est consommé ; on présente celui du pas
        // suivant (fenêtre ±1 acceptée, pas strictement supérieur).
        totpCode: totp.generate({ timestamp: Date.now() + 30_000 }),
      })
      .expect(200);

    // Code de secours : accepté une fois (casse et tiret libres), avec le restant ; rejoué → 401.
    // (Le login est throttlé à 10 / 15 min par IP : on limite le nombre de tentatives ici.)
    const viaBackup = await request(server)
      .post('/auth/login')
      .send({
        email: email2,
        password: 'motdepasse-long-12',
        totpCode: backupCodes[0].toUpperCase().replace('-', ' '),
      })
      .expect(200);
    expect(viaBackup.body.backupCodesRemaining).toBe(9);
    expect(viaBackup.body.user.email).toBe(email2);
    await request(server)
      .post('/auth/login')
      .send({
        email: email2,
        password: 'motdepasse-long-12',
        totpCode: backupCodes[0],
      })
      .expect(401);

    // Régénération : mot de passe exigé ; nouveau jeu complet.
    await request(server)
      .post('/auth/me/2fa/backup-codes')
      .set('Cookie', allCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ password: 'mauvais' })
      .expect(401);
    const regen = await request(server)
      .post('/auth/me/2fa/backup-codes')
      .set('Cookie', allCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({ password: 'motdepasse-long-12' })
      .expect(200);
    expect(regen.body.backupCodes).toHaveLength(10);
    expect(regen.body.backupCodes).not.toContain(backupCodes[1]);
    const after = await request(server)
      .get('/auth/me/2fa/backup-codes')
      .set('Cookie', allCookies)
      .expect(200);
    expect(after.body.remaining).toBe(10);
  });
});
