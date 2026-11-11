import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  JWT_AUDIENCE,
  JWT_ISSUER,
  MFA_PENDING_AUDIENCE,
  TokenService,
} from './token.service';

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

describe('TokenService — preuve « premier facteur validé, second en attente »', () => {
  let svc: TokenService;
  beforeEach(() => {
    svc = new TokenService({ JWT_SECRET: SECRET });
  });
  afterEach(() => vi.useRealTimers());

  it('signe puis vérifie une preuve (round-trip)', async () => {
    const proof = await svc.signMfaPending({ sub: 'u1', sv: 3 });
    expect(await svc.verifyMfaPending(proof)).toEqual({ sub: 'u1', sv: 3 });
  });

  it('signe en HS256, pour une audience à part, avec une expiration à 5 minutes', async () => {
    const proof = await svc.signMfaPending({ sub: 'u1', sv: 0 });
    const { header, payload } = jwt.decode(proof, { complete: true }) as {
      header: { alg: string };
      payload: { iss: string; aud: string; iat: number; exp: number };
    };
    expect(header.alg).toBe('HS256');
    expect(payload.iss).toBe(JWT_ISSUER);
    expect(payload.aud).toBe(MFA_PENDING_AUDIENCE);
    expect(MFA_PENDING_AUDIENCE).not.toBe(JWT_AUDIENCE);
    expect(payload.exp - payload.iat).toBe(5 * 60);
  });

  it('une preuve en attente n’est jamais acceptée comme jeton de session', async () => {
    const proof = await svc.signMfaPending({ sub: 'u1', sv: 3 });
    await expect(svc.verify(proof)).rejects.toBeDefined();
  });

  it('un jeton de session n’est jamais accepté comme preuve en attente', async () => {
    const session = await svc.sign({ sub: 'u1', email: 'a@b.com', sv: 3 });
    await expect(svc.verifyMfaPending(session)).rejects.toBeDefined();
  });

  it('refuse une preuve expirée (5 minutes passées)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const proof = await svc.signMfaPending({ sub: 'u1', sv: 3 });
    vi.setSystemTime(new Date('2026-01-01T00:04:59Z'));
    expect(await svc.verifyMfaPending(proof)).toEqual({ sub: 'u1', sv: 3 });
    vi.setSystemTime(new Date('2026-01-01T00:05:01Z'));
    await expect(svc.verifyMfaPending(proof)).rejects.toBeDefined();
  });

  it('refuse une preuve signée avec un autre secret, illisible ou sans version de session', async () => {
    const other = new TokenService({ JWT_SECRET: 'y'.repeat(32) });
    await expect(
      svc.verifyMfaPending(await other.signMfaPending({ sub: 'u1', sv: 0 })),
    ).rejects.toBeDefined();
    await expect(svc.verifyMfaPending('garbage')).rejects.toBeDefined();
    const noVersion = jwt.sign({ sub: 'u1' }, SECRET, {
      issuer: JWT_ISSUER,
      audience: MFA_PENDING_AUDIENCE,
    });
    await expect(svc.verifyMfaPending(noVersion)).rejects.toBeDefined();
  });
});
