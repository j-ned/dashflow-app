import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { JWT_AUDIENCE, JWT_ISSUER, TokenService } from './token.service';

const SECRET = 'x'.repeat(32);

describe('TokenService', () => {
  let svc: TokenService;
  beforeEach(() => {
    svc = new TokenService({ JWT_SECRET: SECRET });
  });
  it('signe puis vérifie un token (round-trip)', async () => {
    const token = await svc.sign({ sub: 'u1', email: 'a@b.com', sv: 3 });
    const payload = await svc.verify(token);
    expect(payload).toEqual({ sub: 'u1', email: 'a@b.com', sv: 3 });
  });
  it('signe en HS256 avec iss/aud et une expiration à 7 jours', async () => {
    const token = await svc.sign({ sub: 'u1', email: 'a@b.com', sv: 0 });
    const { header, payload } = jwt.decode(token, { complete: true }) as {
      header: { alg: string };
      payload: { iss: string; aud: string; iat: number; exp: number };
    };
    expect(header.alg).toBe('HS256');
    expect(payload.iss).toBe(JWT_ISSUER);
    expect(payload.aud).toBe(JWT_AUDIENCE);
    expect(payload.exp - payload.iat).toBe(7 * 24 * 3600);
  });
  it('rejette un token invalide', async () => {
    await expect(svc.verify('garbage')).rejects.toBeDefined();
  });
  it('rejette un token signé avec un autre secret', async () => {
    const other = new TokenService({ JWT_SECRET: 'y'.repeat(32) });
    const token = await other.sign({ sub: 'u1', email: 'a@b.com', sv: 0 });
    await expect(svc.verify(token)).rejects.toBeDefined();
  });
  it('rejette un token pour une autre audience', async () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', sv: 0 }, SECRET, {
      issuer: JWT_ISSUER,
      audience: 'autre-service',
    });
    await expect(svc.verify(token)).rejects.toBeDefined();
  });
  it('rejette un token non signé (alg none)', async () => {
    const token = jwt.sign({ sub: 'u1', email: 'a@b.com', sv: 0 }, null, {
      algorithm: 'none',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    await expect(svc.verify(token)).rejects.toBeDefined();
  });
});
