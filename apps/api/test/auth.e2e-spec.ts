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
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => { await app.close(); });

  it('register → verify → cookie → GET /me', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(201);

    const verify = await request(app.getHttpServer())
      .post('/api/auth/verify')
      .send({ email, code: mailer.lastCode })
      .expect(200);

    const cookie = verify.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];
    expect(cookieArr.join(';')).toContain('dashflow_session');

    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookieArr)
      .expect(200);

    expect(me.body.user.email).toBe(email);
    expect(me.body.user.hasPassword).toBe(true);
    expect(me.body.user.password).toBeUndefined();
  });

  it('login mauvais mot de passe → 401', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'mauvais' })
      .expect(401);
  });

  it('mutation authentifiée sans CSRF → 403', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'motdepasse-long-12' })
      .expect(200);

    const loginCookie = login.headers['set-cookie'] as string | string[];
    const loginCookieArr = Array.isArray(loginCookie) ? loginCookie : [loginCookie];

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', loginCookieArr)
      .expect(403);
  });
});
