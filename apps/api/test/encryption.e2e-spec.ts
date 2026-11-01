import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startApi, type E2eApi } from './e2e/api-server';
import { authKey } from './auth-key';

// Serveur dédié : les compteurs de throttling (par IP et par route) sont en mémoire, par processus.
describe('Encryption e2e', () => {
  let api: E2eApi;

  beforeAll(async () => {
    api = await startApi();
  });

  afterAll(async () => {
    await api?.stop();
  });

  it('compte E2EE : remplacer les clés exige le mot de passe, le reset classique est refusé et le reset avec récupération est atomique', async () => {
    const email = `e2ekeys+${Date.now()}@dashflow.test`;
    const password = authKey('motdepasse-long-12');
    const server = api.url;
    await request(server)
      .post('/auth/register')
      .send({ email, password })
      .expect(201);
    const verify = await request(server)
      .post('/auth/verify')
      .send({ email, code: api.mail.lastCode })
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
    const code = api.mail.lastCode;
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
