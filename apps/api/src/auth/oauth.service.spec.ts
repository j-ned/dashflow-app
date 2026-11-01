import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OAuthService } from './oauth.service';
import type { AuthRepository } from './auth.repository';

const config = (id?: string) => ({
  GOOGLE_CLIENT_ID: id,
  GOOGLE_CLIENT_SECRET: id ? 'secret' : undefined,
  APP_URL: 'http://localhost:3001',
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

  it('createAuthorization : URL Google + state + verifier', async () => {
    const svc = new OAuthService(config('cid'), r as unknown as AuthRepository);
    const { url, state, codeVerifier } = await svc.createAuthorization();
    expect(url).toContain('accounts.google.com');
    expect(state.length).toBeGreaterThan(0);
    expect(codeVerifier.length).toBeGreaterThan(0);
  });

  it('createAuthorization : lance si non configuré', async () => {
    const svc = new OAuthService(
      config(undefined),
      r as unknown as AuthRepository,
    );
    await expect(svc.createAuthorization()).rejects.toThrow();
  });

  it('findOrCreate : googleId existant → renvoie le user', async () => {
    const svc = new OAuthService(config('cid'), r as unknown as AuthRepository);
    r.findByGoogleId.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const user = await svc.findOrCreateGoogleUser({
      googleId: 'g1',
      email: 'a@b.com',
      displayName: 'A',
    });
    expect(user.id).toBe('u1');
    expect(r.createUser).not.toHaveBeenCalled();
  });

  it('findOrCreate : email existant VÉRIFIÉ sans googleId → lien du googleId seul, credentials intacts', async () => {
    const svc = new OAuthService(config('cid'), r as unknown as AuthRepository);
    r.findByGoogleId.mockResolvedValue(undefined);
    r.findByEmail.mockResolvedValue({
      id: 'u2',
      email: 'a@b.com',
      emailVerified: new Date('2026-01-01'),
    });
    r.updateUser.mockResolvedValue({ id: 'u2', email: 'a@b.com' });
    await svc.findOrCreateGoogleUser({
      googleId: 'g1',
      email: 'a@b.com',
      displayName: 'A',
    });
    expect(r.updateUser).toHaveBeenCalledWith('u2', { googleId: 'g1' });
  });

  it('findOrCreate : email existant NON vérifié → pre-account-takeover neutralisé (password/2FA effacés, puis vérifié)', async () => {
    const svc = new OAuthService(config('cid'), r as unknown as AuthRepository);
    r.findByGoogleId.mockResolvedValue(undefined);
    r.findByEmail.mockResolvedValue({
      id: 'u2',
      email: 'a@b.com',
      password: 'hash-de-l-attaquant',
      totpSecret: 'S',
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
        password: null,
        totpSecret: null,
        totpEnabled: null,
        emailVerified: expect.any(Date),
      }),
    );
  });

  it('findOrCreate : inconnu → création sans password', async () => {
    const svc = new OAuthService(config('cid'), r as unknown as AuthRepository);
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
