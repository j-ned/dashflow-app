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
});
