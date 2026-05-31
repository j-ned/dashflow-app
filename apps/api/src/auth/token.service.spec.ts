import { describe, it, expect, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let svc: TokenService;
  beforeEach(() => {
    svc = new TokenService(new JwtService({ secret: 'x'.repeat(32), signOptions: { expiresIn: '7d' } }));
  });
  it('signe puis vérifie un token (round-trip)', async () => {
    const token = await svc.sign({ sub: 'u1', email: 'a@b.com' });
    const payload = await svc.verify(token);
    expect(payload.sub).toBe('u1');
    expect(payload.email).toBe('a@b.com');
  });
  it('rejette un token invalide', async () => {
    await expect(svc.verify('garbage')).rejects.toBeDefined();
  });
});
