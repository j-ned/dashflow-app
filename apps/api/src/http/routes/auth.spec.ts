import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  jsonInit,
  multipartInit,
  TEST_USER,
  type HonoTestApp,
} from '../../../test/support/hono-test-app';
import { SESSION_COOKIE } from '../../auth/cookie';
import type { AuthService } from '../../auth/auth.service';
import type { DemoService } from '../../modules/demo/demo.service';
import type { StorageService } from '../../storage/storage.service';

// Signature PNG + IHDR minimal : reconnu par file-type comme image/png.
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49,
  0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06,
  0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
]);

const AVATAR_KEY = `avatars/${TEST_USER.id}.png`;

const DB_USER = {
  id: TEST_USER.id,
  email: TEST_USER.email,
  displayName: 'Alice',
  avatarUrl: AVATAR_KEY,
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

/** En-têtes `Set-Cookie` de la réponse, un par cookie. */
const setCookies = (res: Response): string[] => res.headers.getSetCookie();

describe('Routes /auth — DELETE /auth/me (suppression de compte RGPD, Hono)', () => {
  function authMock() {
    return {
      deleteAccount: vi.fn().mockResolvedValue({ success: true, data: null }),
    };
  }

  it('appel authentifié → 204 et appelle authService.deleteAccount(userId)', async () => {
    const auth = authMock();
    const t = await honoTestApp({ auth: auth as unknown as AuthService });

    const res = await t.authed('/auth/me', { method: 'DELETE' });

    expect(res.status).toBe(204);
    expect(auth.deleteAccount).toHaveBeenCalledWith(TEST_USER.id);
  });

  it('vide le cookie de session (Set-Cookie SESSION_COOKIE vidé, Max-Age=0)', async () => {
    const t = await honoTestApp({
      auth: authMock() as unknown as AuthService,
    });

    const res = await t.authed('/auth/me', { method: 'DELETE' });

    const cleared = setCookies(res).find((c) =>
      c.startsWith(`${SESSION_COOKIE}=`),
    );
    expect(cleared).toBeDefined();
    expect(cleared).toMatch(new RegExp(`^${SESSION_COOKIE}=;`));
    expect(cleared).toMatch(/Max-Age=0/i);
  });
});

// Couverture HTTP multipart de POST /auth/me/avatar. Champ attendu : `file`. Le mimetype doit
// être une image (jpeg/png/webp) ; la route valide la liste blanche avant l'upload.
describe('Routes /auth — POST /auth/me/avatar (multipart, Hono)', () => {
  function mocks() {
    const auth = { setAvatar: vi.fn().mockResolvedValue(DB_USER) };
    const storage = {
      avatarKey: vi.fn(() => AVATAR_KEY),
      deletePrefix: vi.fn().mockResolvedValue(undefined),
      upload: vi.fn().mockResolvedValue(undefined),
      getStream: vi.fn(),
    };
    return { auth, storage };
  }

  async function setup() {
    const m = mocks();
    const t = await honoTestApp({
      auth: m.auth as unknown as AuthService,
      storage: m.storage as unknown as StorageService,
    });
    return { ...m, t };
  }

  it('contenu non-image déclaré image/png → 400 (magic-bytes), rien uploadé', async () => {
    const { t, storage } = await setup();

    const res = await t.authed(
      '/auth/me/avatar',
      multipartInit('file', Buffer.from('fakepngbytes'), 'image/png'),
    );

    expect(res.status).toBe(400);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('GIF déclaré → 400 (format retiré de la whitelist)', async () => {
    const { t, storage } = await setup();

    const res = await t.authed(
      '/auth/me/avatar',
      multipartInit('file', Buffer.from('GIF89a'), 'image/gif'),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Type image invalide' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("champ 'file' image → 201, storage.upload appelé, auth.setAvatar reçoit la clé", async () => {
    const { t, auth, storage } = await setup();

    const res = await t.authed(
      '/auth/me/avatar',
      multipartInit('file', PNG_BYTES, 'image/png'),
    );

    expect(res.status).toBe(201);
    expect(storage.deletePrefix).toHaveBeenCalledWith(
      `avatars/${TEST_USER.id}.`,
    );
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(storage.upload).toHaveBeenCalledWith(
      AVATAR_KEY,
      expect.any(Buffer),
      'image/png',
      'public, max-age=31536000, immutable',
    );
    expect(auth.setAvatar).toHaveBeenCalledWith(TEST_USER.id, AVATAR_KEY);
    expect(await res.json()).toMatchObject({
      id: TEST_USER.id,
      avatarUrl: `/auth/avatar/${TEST_USER.id}`,
    });
  });

  it('sans fichier → 400, storage.upload jamais appelé', async () => {
    const { t, auth, storage } = await setup();

    const res = await t.authed('/auth/me/avatar', { method: 'POST' });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Fichier requis' });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(auth.setAvatar).not.toHaveBeenCalled();
  });

  it('mimetype non-image (pdf) → 400 (type image invalide), upload jamais appelé', async () => {
    const { t, auth, storage } = await setup();

    const res = await t.authed(
      '/auth/me/avatar',
      multipartInit('file', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Type image invalide' });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(auth.setAvatar).not.toHaveBeenCalled();
  });
});

// Session démo (claim `demo` du JWT → user.isDemo). Le vrai middleware `rejectDemo` doit
// produire le 403, avant toute lecture du corps et tout appel de service.
describe('Routes /auth — session démo : routes d’identité verrouillées (Hono)', () => {
  function mocks() {
    const auth = {
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      setPassword: vi.fn(),
      setupTotp: vi.fn(),
      enableTotp: vi.fn(),
      disableTotp: vi.fn(),
      setAvatar: vi.fn(),
      deleteAccount: vi.fn(),
    };
    const demo = { reset: vi.fn().mockResolvedValue(undefined) };
    const storage = { upload: vi.fn(), deletePrefix: vi.fn() };
    return { auth, demo, storage };
  }

  async function setup() {
    const m = mocks();
    const t = await honoTestApp(
      {
        auth: m.auth as unknown as AuthService,
        demo: m.demo as unknown as DemoService,
        storage: m.storage as unknown as StorageService,
      },
      { ...TEST_USER, demo: true },
    );
    return { ...m, t };
  }

  it.each([
    ['PATCH', '/auth/me'],
    ['PATCH', '/auth/me/password'],
    ['POST', '/auth/me/set-password'],
    ['POST', '/auth/me/2fa/setup'],
    ['POST', '/auth/me/2fa/verify'],
    ['POST', '/auth/me/2fa/disable'],
    ['POST', '/auth/me/avatar'],
    ['DELETE', '/auth/me'],
  ] as const)('%s %s → 403, service jamais appelé', async (method, path) => {
    const { t, auth, storage } = await setup();

    const res = await t.authed(path, jsonInit(method, {}));

    expect(res.status).toBe(403);
    for (const fn of Object.values(auth)) expect(fn).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('POST /auth/demo-reset reste autorisé au compte démo', async () => {
    const { t, demo } = await setup();

    const res = await t.authed('/auth/demo-reset', { method: 'POST' });

    expect(res.status).toBe(200);
    expect(demo.reset).toHaveBeenCalledWith(TEST_USER.id);
  });
});

describe('Routes /auth — POST /auth/register (limite par e-mail)', () => {
  const register = (t: HonoTestApp, email: string, ip: string) =>
    t.anonymous('/auth/register', {
      ...jsonInit('POST', { email, password: 'a'.repeat(64) }),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    });

  it('11 inscriptions de la même adresse depuis 11 IP : la 11ᵉ est refusée, une autre adresse passe', async () => {
    const auth = {
      register: vi.fn().mockResolvedValue({ success: true, data: {} }),
    };
    const t = await honoTestApp({ auth: auth as unknown as AuthService });

    for (let i = 1; i <= 10; i++)
      expect(
        (await register(t, 'cible@example.test', `198.51.100.${i}`)).status,
      ).toBe(201);
    const flooded = await register(t, 'cible@example.test', '198.51.100.11');
    const other = await register(t, 'autre@example.test', '198.51.100.12');

    expect(flooded.status).toBe(429);
    expect(other.status).toBe(201);
    expect(auth.register).toHaveBeenCalledTimes(11);
  });
});

describe('Routes /auth — POST /auth/logout', () => {
  const logout = (t: HonoTestApp) =>
    t.authed('/auth/logout', { method: 'POST' });

  it('compte ordinaire : révoque toutes ses sessions (tous les appareils)', async () => {
    const auth = { revokeSessions: vi.fn().mockResolvedValue({}) };
    const t = await honoTestApp({ auth: auth as unknown as AuthService });

    expect((await logout(t)).status).toBe(200);

    expect(auth.revokeSessions).toHaveBeenCalledWith(TEST_USER.id);
  });

  it('compte démo partagé : ferme seulement cette session, sans déconnecter les autres visiteurs', async () => {
    const auth = { revokeSessions: vi.fn().mockResolvedValue({}) };
    const t = await honoTestApp(
      { auth: auth as unknown as AuthService },
      { ...TEST_USER, demo: true },
    );

    const res = await logout(t);

    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toMatch(/Max-Age=0/);
    expect(auth.revokeSessions).not.toHaveBeenCalled();
  });
});
