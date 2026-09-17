import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/mail/mailer';
import postgres from 'postgres';
import argon2 from 'argon2';
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
  async sendCalendarInvitation(
    _to: string,
    _senderName: string,
    _calendarToken: string,
  ) {
    /* no-op */
  }
}

// Application dédiée : les compteurs de throttling (par IP et par route) sont en mémoire, par app.
describe('Auth upgrade e2e', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER)
      .useValue(new CapturingMailer())
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('compte d’avant la dérivation côté client : prelogin 0 → login au mot de passe → upgrade → prelogin 1, seule la clé ouvre ensuite', async () => {
    const server = app.getHttpServer();
    const legacy = `e2elegacy+${Date.now()}@dashflow.test`;
    const rawPassword = 'mot-de-passe-historique';
    const sql = postgres(process.env.DATABASE_URL!);
    try {
      await sql`insert into users (email, password, email_verified) values (${legacy}, ${await argon2.hash(rawPassword)}, now())`;
    } finally {
      await sql.end();
    }

    const unknown = await request(server)
      .post('/auth/prelogin')
      .send({ email: `personne+${Date.now()}@dashflow.test` })
      .expect(200);
    expect(unknown.body).toEqual({ authVersion: 1 });
    const before = await request(server)
      .post('/auth/prelogin')
      .send({ email: legacy })
      .expect(200);
    expect(before.body).toEqual({ authVersion: 0 });

    const login = await request(server)
      .post('/auth/login')
      .send({ email: legacy, password: rawPassword })
      .expect(200);
    expect(login.body.user.authVersion).toBe(0);
    const cookie = login.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];
    const upgrade = (currentPassword: string) =>
      request(server)
        .post('/auth/me/upgrade-auth')
        .set('Cookie', cookieArr)
        .set('X-CSRF-Token', login.body.csrfToken as string)
        .send({ currentPassword, authKey: authKey(rawPassword) });

    await upgrade('pas-le-bon').expect(401);
    const upgraded = await upgrade(rawPassword).expect(200);
    expect(upgraded.body.authVersion).toBe(1);
    // La session ouverte reste valide : ce n'est pas un changement de mot de passe.
    await request(server).get('/auth/me').set('Cookie', cookieArr).expect(200);

    const after = await request(server)
      .post('/auth/prelogin')
      .send({ email: legacy })
      .expect(200);
    expect(after.body).toEqual({ authVersion: 1 });
    await request(server)
      .post('/auth/login')
      .send({ email: legacy, password: rawPassword })
      .expect(401);
    await request(server)
      .post('/auth/login')
      .send({ email: legacy, password: authKey(rawPassword) })
      .expect(200);
  });
});
