import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { MAILER, type Mailer } from '../src/mail/mailer';
import { authKey } from './auth-key';

class CapturingMailer implements Mailer {
  sendSecurityNotice(): Promise<void> {
    return Promise.resolve();
  }
  sendAccountExists(): Promise<void> {
    return Promise.resolve();
  }
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
describe('Encryption e2e', () => {
  let app: INestApplication;
  const mailer = new CapturingMailer();

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

  it('compte E2EE : remplacer les clés exige le mot de passe, le reset classique est refusé et le reset avec récupération est atomique', async () => {
    const email = `e2ekeys+${Date.now()}@dashflow.test`;
    const password = authKey('motdepasse-long-12');
    const server = app.getHttpServer();
    await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    const verify = await request(server)
      .post('/auth/verify')
      .send({ email, code: mailer.lastCode })
      .expect(200);
    const cookie = verify.headers['set-cookie'] as string | string[];
    const cookieArr = Array.isArray(cookie) ? cookie : [cookie];
    const csrfToken = verify.body.csrfToken as string;
    const keys = {
      salt: 's1',
      wrappedMasterKey: 'w1',
      recoveryWrappedKey: 'r1',
    };
    const patchKeys = (body: Record<string, string>) =>
      request(server)
        .patch('/auth/me/encryption-keys')
        .set('Cookie', cookieArr)
        .set('X-CSRF-Token', csrfToken)
        .send(body);

    // Première pose : libre. Remplacement : mot de passe courant exigé.
    await patchKeys(keys).expect(200);
    const denied = await patchKeys({ ...keys, wrappedMasterKey: 'pwned' });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('REAUTH_REQUIRED');
    await patchKeys({ ...keys, currentPassword: authKey('pas-le-bon') }).expect(
      403,
    );
    await patchKeys({
      ...keys,
      wrappedMasterKey: 'w2',
      currentPassword: password,
    }).expect(200);

    // L'ancien endpoint d'effacement sur simple session n'existe plus.
    await request(server)
      .post('/auth/me/wipe-encryption')
      .set('Cookie', cookieArr)
      .set('X-CSRF-Token', csrfToken)
      .expect(404);

    // Reset classique refusé, le code reste utilisable pour le reset avec récupération.
    await request(server)
      .post('/auth/forgot-password')
      .send({ email })
      .expect(200);
    const code = mailer.lastCode;
    const refused = await request(server)
      .post('/auth/reset-password')
      .send({ email, code, newPassword: authKey('nouveau-motdepasse-12') });
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('E2EE_RECOVERY_REQUIRED');
    expect(refused.body.details).toEqual({ recoveryWrappedKey: 'r1' });
    await request(server)
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    await request(server)
      .post('/auth/reset-password-with-recovery')
      .send({ email, code, newPassword: authKey('nouveau-motdepasse-12') })
      .expect(400);
    await request(server)
      .post('/auth/reset-password-with-recovery')
      .send({
        email,
        code,
        newPassword: authKey('nouveau-motdepasse-12'),
        newSalt: 's3',
        newWrappedMasterKey: 'w3',
      })
      .expect(200);

    const login = await request(server)
      .post('/auth/login')
      .send({ email, password: authKey('nouveau-motdepasse-12') })
      .expect(200);
    expect(login.body.keyMaterial).toMatchObject({
      salt: 's3',
      wrappedMasterKey: 'w3',
      recoveryWrappedKey: 'r1',
    });
  });
});
