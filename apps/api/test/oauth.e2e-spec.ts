import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startApi, type E2eApi } from './e2e/api-server';

describe('OAuth e2e', () => {
  let api: E2eApi;

  beforeAll(async () => {
    api = await startApi({
      env: {
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_CLIENT_SECRET: 'test-secret',
      },
    });
  });
  afterAll(async () => {
    await api?.stop();
  });

  it('GET /auth/oauth/google → 302 vers Google + cookies state/verifier', async () => {
    const res = await request(api.url).get('/auth/oauth/google').expect(302);
    expect(res.headers.location).toContain('accounts.google.com');
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(
      ';',
    );
    expect(setCookie).toContain('dashflow_oauth_state');
    expect(setCookie).toContain('dashflow_oauth_verifier');
  });

  it('POST /auth/oauth/google/mfa sans preuve du passage par Google → 401 MFA_PROOF_REJECTED, aucune session', async () => {
    const res = await request(api.url)
      .post('/auth/oauth/google/mfa')
      .send({ totpCode: '123456' })
      .expect(401);
    expect(res.body).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(
      ';',
    );
    expect(setCookie).not.toContain('dashflow_session');
  });

  it('POST /auth/oauth/google/mfa avec une preuve falsifiée → 401, cookie de preuve vidé', async () => {
    const res = await request(api.url)
      .post('/auth/oauth/google/mfa')
      .set('Cookie', 'dashflow_oauth_mfa=pas-un-jeton')
      .send({ totpCode: '123456' })
      .expect(401);
    expect(res.body).toMatchObject({ code: 'MFA_PROOF_REJECTED' });
    const setCookie = (res.headers['set-cookie'] as unknown as string[]).join(
      ';',
    );
    expect(setCookie).toMatch(/dashflow_oauth_mfa=;.*Max-Age=0/i);
    expect(setCookie).not.toContain('dashflow_session');
  });
});
