import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { DemoService } from '../modules/demo/demo.service';
import { StorageService } from '../storage/storage.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../common/guards/csrf.guard';
import { SESSION_COOKIE } from './cookie';

// RED attendu : la route DELETE /auth/me n'existe pas encore (handler absent → 404).
// Le comportement (204, appel service avec l'userId courant, purge du cookie de session) est dû au GREEN.
describe('AuthController — DELETE /auth/me (suppression de compte RGPD)', () => {
  let app: INestApplication;
  const mockAuth = { deleteAccount: vi.fn() };
  const mockConfig = { get: (k: string) => (k === 'DEMO_ENABLED' ? false : 'test') };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: TokenService, useValue: {} },
        { provide: DemoService, useValue: {} },
        { provide: StorageService, useValue: {} },
        { provide: ConfigService, useValue: mockConfig },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest().user = { id: 'u1', email: 'a@b.com' };
          return true;
        },
      })
      .overrideGuard(CsrfGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockAuth.deleteAccount.mockReset().mockResolvedValue({ success: true, data: null });
  });

  it('appel authentifié → 204 et appelle authService.deleteAccount(userId)', async () => {
    const res = await request(app.getHttpServer()).delete('/auth/me');

    expect(res.status).toBe(204);
    expect(mockAuth.deleteAccount).toHaveBeenCalledWith('u1');
  });

  it('vide le cookie de session (clearCookie sur SESSION_COOKIE)', async () => {
    const res = await request(app.getHttpServer()).delete('/auth/me');

    const setCookie = res.headers['set-cookie'] ?? [];
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
    expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(true);
  });
});
