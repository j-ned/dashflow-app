import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { OAuthService } from './oauth.service';
import type { AuthRepository } from './auth.repository';
import type { Env } from '../config/env.schema';

const config = (id?: string) => ({
  get: vi.fn((k: string) => {
    const values: Record<string, string | undefined> = {
      GOOGLE_CLIENT_ID: id,
      GOOGLE_CLIENT_SECRET: id ? 'secret' : undefined,
      APP_URL: 'http://localhost:3001',
    };
    return values[k];
  }),
});
const repo = () => ({
  findByGoogleId: vi.fn(),
  findByEmail: vi.fn(),
  updateUser: vi.fn(),
  createUser: vi.fn(),
});

describe('OAuthService', () => {
  let r: ReturnType<typeof repo>;
  beforeEach(() => {
    r = repo();
  });

  it('createAuthorization : URL Google + state + verifier', () => {
    const svc = new OAuthService(
      config('cid') as unknown as ConfigService<Env, true>,
      r as unknown as AuthRepository,
    );
    const { url, state, codeVerifier } = svc.createAuthorization();
    expect(url).toContain('accounts.google.com');
    expect(state.length).toBeGreaterThan(0);
    expect(codeVerifier.length).toBeGreaterThan(0);
  });

  it('createAuthorization : lance si non configuré', () => {
    const svc = new OAuthService(
      config(undefined) as unknown as ConfigService<Env, true>,
      r as unknown as AuthRepository,
    );
    expect(() => svc.createAuthorization()).toThrow();
  });

  it('findOrCreate : googleId existant → renvoie le user', async () => {
    const svc = new OAuthService(
      config('cid') as unknown as ConfigService<Env, true>,
      r as unknown as AuthRepository,
    );
    r.findByGoogleId.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const user = await svc.findOrCreateGoogleUser({
      googleId: 'g1',
      email: 'a@b.com',
      displayName: 'A',
    });
    expect(user.id).toBe('u1');
    expect(r.createUser).not.toHaveBeenCalled();
  });

  it('findOrCreate : email existant sans googleId → lien', async () => {
    const svc = new OAuthService(
      config('cid') as unknown as ConfigService<Env, true>,
      r as unknown as AuthRepository,
    );
    r.findByGoogleId.mockResolvedValue(undefined);
    r.findByEmail.mockResolvedValue({
      id: 'u2',
      email: 'a@b.com',
      emailVerified: null,
    });
    r.updateUser.mockResolvedValue({ id: 'u2', email: 'a@b.com' });
    await svc.findOrCreateGoogleUser({
      googleId: 'g1',
      email: 'a@b.com',
      displayName: 'A',
    });
    expect(r.updateUser).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        googleId: 'g1',
        emailVerified: expect.any(Date),
      }),
    );
  });

  it('findOrCreate : inconnu → création sans password', async () => {
    const svc = new OAuthService(
      config('cid') as unknown as ConfigService<Env, true>,
      r as unknown as AuthRepository,
    );
    r.findByGoogleId.mockResolvedValue(undefined);
    r.findByEmail.mockResolvedValue(undefined);
    r.createUser.mockResolvedValue({ id: 'u3', email: 'a@b.com' });
    r.updateUser.mockResolvedValue({
      id: 'u3',
      email: 'a@b.com',
      googleId: 'g1',
    });
    await svc.findOrCreateGoogleUser({
      googleId: 'g1',
      email: 'a@b.com',
      displayName: 'A',
    });
    const arg = r.createUser.mock.calls[0][0];
    expect(arg.password).toBeNull();
  });
});
