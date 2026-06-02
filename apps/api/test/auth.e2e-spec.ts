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
  async sendVerificationCode(_to: string, code: string) { this.lastCode = code; }
  async sendPasswordResetCode(_to: string, code: string) { this.lastCode = code; }
  async sendCalendarInvitation(_to: string, _senderName: string, _calendarToken: string) { /* no-op */ }
}

describe('Auth e2e', () => {
  let app: INestApplication;
  const mailer = new CapturingMailer();
  const email = `e2e+${Date.now()}@dashflow.test`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER).useValue(mailer).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => { await app.close(); });

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
    const loginCookieArr = Array.isArray(loginCookie) ? loginCookie : [loginCookie];

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', loginCookieArr)
      .expect(403);
  });

  it('2FA : setup → enable → login exige le code', async () => {
    const email2 = `e2e2fa+${Date.now()}@dashflow.test`;
    const server = app.getHttpServer();
    await request(server).post('/auth/register').send({ email: email2, password: 'motdepasse-long-12' }).expect(201);
    const verify = await request(server).post('/auth/verify').send({ email: email2, code: mailer.lastCode }).expect(200);
    const cookie = verify.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];

    const csrf = await request(server).get('/auth/csrf').set('Cookie', cookieArr).expect(200);
    const csrfCookie = csrf.headers['set-cookie'] as string | string[];
    const allCookies = cookieArr.concat(Array.isArray(csrfCookie) ? csrfCookie : [csrfCookie]);
    const csrfToken = csrf.body.csrfToken as string;

    const setup = await request(server).post('/auth/me/2fa/setup')
      .set('Cookie', allCookies).set('X-CSRF-Token', csrfToken).expect(200);
    const secret = setup.body.secret as string;
    const totp = new OTPAuth.TOTP({ issuer: 'DashFlow', secret: OTPAuth.Secret.fromBase32(secret) });

    await request(server).post('/auth/me/2fa/verify')
      .set('Cookie', allCookies).set('X-CSRF-Token', csrfToken).send({ code: totp.generate() }).expect(200);

    const noCode = await request(server).post('/auth/login').send({ email: email2, password: 'motdepasse-long-12' }).expect(403);
    expect(noCode.body.code).toBe('TOTP_REQUIRED');
    await request(server).post('/auth/login')
      .send({ email: email2, password: 'motdepasse-long-12', totpCode: totp.generate() }).expect(200);
  });
});
