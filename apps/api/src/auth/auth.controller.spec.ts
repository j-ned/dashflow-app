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

// Couverture HTTP multipart de POST /auth/me/avatar.
// Champ multer attendu : FileInterceptor('file'). Le mimetype doit être une image
// (jpeg/png/webp/gif) ; le controller valide la liste blanche avant l'upload.
describe('AuthController — POST /auth/me/avatar (multipart)', () => {
  let app: INestApplication;

  const DB_USER = {
    id: 'u1',
    email: 'a@b.com',
    displayName: 'Alice',
    avatarUrl: 'avatars/u1.png',
    totpEnabled: false,
    password: 'hash',
    googleId: null,
    encryptionVersion: 1,
    encryptionPassphrase: false,
    isDemoAccount: false,
    role: 'user',
    encryptionSalt: null,
    wrappedMasterKey: null,
    recoveryWrappedKey: null,
  };

  const mockAuth = { setAvatar: vi.fn() };
  const mockStorage = { avatarKey: vi.fn(() => 'avatars/u1.png'), upload: vi.fn(), getStream: vi.fn() };
  const mockConfig = { get: (k: string) => (k === 'DEMO_ENABLED' ? false : 'test') };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuth },
        { provide: TokenService, useValue: {} },
        { provide: DemoService, useValue: {} },
        { provide: StorageService, useValue: mockStorage },
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
    mockAuth.setAvatar.mockReset().mockResolvedValue(DB_USER);
    mockStorage.avatarKey.mockClear();
    mockStorage.upload.mockReset().mockResolvedValue(undefined);
  });

  it("champ 'file' image → 201, storage.upload appelé, auth.setAvatar reçoit la clé", async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/me/avatar')
      .attach('file', Buffer.from('fakepngbytes'), { filename: 'a.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(mockStorage.upload).toHaveBeenCalledTimes(1);
    expect(mockAuth.setAvatar).toHaveBeenCalledWith('u1', 'avatars/u1.png');
    expect(res.body).toMatchObject({ id: 'u1', avatarUrl: '/auth/avatar/u1' });
  });

  it('sans fichier → 400, storage.upload jamais appelé', async () => {
    const res = await request(app.getHttpServer()).post('/auth/me/avatar');

    expect(res.status).toBe(400);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockAuth.setAvatar).not.toHaveBeenCalled();
  });

  it('mimetype non-image (pdf) → 400 (type image invalide), upload jamais appelé', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/me/avatar')
      .attach('file', Buffer.from('%PDF-1.4'), { filename: 'f.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(mockStorage.upload).not.toHaveBeenCalled();
    expect(mockAuth.setAvatar).not.toHaveBeenCalled();
  });
});
