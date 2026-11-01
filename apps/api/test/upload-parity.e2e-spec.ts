import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { startApi, type E2eApi } from './e2e/api-server';
import { authKey } from './auth-key';
import { UPLOAD_MULTER_LIMIT_BYTES } from '../src/common/files/validate-upload';

/**
 * Parité des envois multipart Nest (multer) / Hono : aucun autre test e2e ne poste de fichier.
 * Sans stockage R2 configuré, on couvre tout ce qui précède l'écriture : gardes, plafond de
 * taille, nom de champ, magic-bytes, ressource inconnue. À supprimer avec l'implémentation Nest.
 */
const NEST = 'node dist/main.js';
const HONO = 'node dist/http/server.js';
const AVATAR_LIMIT = 2 * 1024 * 1024;

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64),
]);
const PDF = Buffer.from(
  '%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
);
const FAKE_PDF = Buffer.from('ceci n’est pas un pdf');

type Session = { cookie: string; csrf: string };
type Part = { field: string; bytes: Buffer; type: string; name?: string };

async function session(api: E2eApi, tag: string): Promise<Session> {
  const email = `upl-${tag}+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
  const json = { 'Content-Type': 'application/json' };
  await fetch(`${api.url}/auth/register`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, password: authKey('motdepasse-long-12') }),
  });
  const verify = await fetch(`${api.url}/auth/verify`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, code: api.mail.lastCode }),
  });
  const { csrfToken } = (await verify.json()) as { csrfToken: string };
  return {
    cookie: verify.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
    csrf: csrfToken,
  };
}

async function post(
  api: E2eApi,
  s: Session,
  path: string,
  parts: Part[] | 'json',
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    Cookie: s.cookie,
    'X-CSRF-Token': s.csrf,
  };
  let body: BodyInit;
  if (parts === 'json') {
    headers['Content-Type'] = 'application/json';
    body = '{}';
  } else {
    const form = new FormData();
    for (const p of parts)
      form.append(
        p.field,
        new Blob([p.bytes], { type: p.type }),
        p.name ?? 'f.bin',
      );
    body = form;
  }
  const res = await fetch(api.url + path, { method: 'POST', headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && 'timestamp' in parsed)
      parsed = { ...parsed, timestamp: '<ts>' };
  } catch {
    // corps non JSON : comparé tel quel
  }
  return { status: res.status, body: parsed };
}

describe('Parité des uploads multipart Nest / Hono', () => {
  let nest: E2eApi;
  let hono: E2eApi;
  const sessions = new Map<E2eApi, Session>();
  const unknownId = randomUUID();

  beforeAll(async () => {
    // Démo active : le cas « compte démo » ouvre une session via /auth/demo-login.
    const env = { DEMO_ENABLED: 'true' };
    [nest, hono] = await Promise.all([
      startApi({ cmd: NEST, env }),
      startApi({ cmd: HONO, env }),
    ]);
    for (const api of [nest, hono])
      sessions.set(api, await session(api, api === nest ? 'n' : 'h'));
  });
  afterAll(async () => {
    await Promise.all([nest?.stop(), hono?.stop()]);
  });

  const both = async (path: string, parts: Part[] | 'json') => {
    const [a, b] = await Promise.all(
      [nest, hono].map((api) => post(api, sessions.get(api)!, path, parts)),
    );
    expect(b).toEqual(a);
    return a;
  };

  /** Écart voulu : multer « Unexpected field » ressort en 500 sous Nest (erreur non traduite,
   * alerte Sentry) ; Hono répond 400. */
  const unexpectedField = async (path: string, parts: Part[]) => {
    const [a, b] = await Promise.all(
      [nest, hono].map((api) => post(api, sessions.get(api)!, path, parts)),
    );
    expect(a.status).toBe(500);
    expect(b).toMatchObject({
      status: 400,
      body: {
        statusCode: 400,
        error: 'BAD_REQUEST',
        message: 'Unexpected field',
      },
    });
  };

  const ROUTES: [string, string, number, Buffer, string][] = [
    ['/auth/me/avatar', 'file', AVATAR_LIMIT, PNG, 'image/png'],
    [
      `/documents/${unknownId}/file`,
      'file',
      UPLOAD_MULTER_LIMIT_BYTES,
      PDF,
      'application/pdf',
    ],
    [
      `/prescriptions/${unknownId}/document`,
      'document',
      UPLOAD_MULTER_LIMIT_BYTES,
      PDF,
      'application/pdf',
    ],
    [
      `/recurring-entries/${unknownId}/payslip`,
      'payslip',
      UPLOAD_MULTER_LIMIT_BYTES,
      PDF,
      'application/pdf',
    ],
    [
      `/salary-archives/${unknownId}/payslip`,
      'payslip',
      UPLOAD_MULTER_LIMIT_BYTES,
      PDF,
      'application/pdf',
    ],
  ];

  describe.each(ROUTES)('%s', (path, field, limit, valid, type) => {
    it('sans fichier (JSON)', async () => {
      expect((await both(path, 'json')).status).toBe(400);
    });
    it('fichier sous un autre nom de champ (Nest 500 → Hono 400)', async () => {
      await unexpectedField(path, [{ field: 'autre', bytes: valid, type }]);
    });
    it('deux fichiers pour le même champ (Nest 500 → Hono 400)', async () => {
      const f = { field, bytes: valid, type };
      await unexpectedField(path, [f, f]);
    });
    it('fichier au-delà du plafond', async () => {
      const big = Buffer.concat([
        valid,
        Buffer.alloc(limit + 1 - valid.length),
      ]);
      expect((await both(path, [{ field, bytes: big, type }])).status).toBe(
        413,
      );
    });
    it('contenu falsifié (magic-bytes)', async () => {
      await both(path, [{ field, bytes: FAKE_PDF, type }]);
    });
    it('fichier valide', async () => {
      // Ressource inconnue (404) ou stockage non configuré (503) : même réponse attendue.
      await both(path, [{ field, bytes: valid, type }]);
    });
  });

  it('création d’archive multipart : refus identiques, sans ligne orpheline côté Hono', async () => {
    await unexpectedField('/salary-archives', [
      { field: 'autre', bytes: PDF, type: 'application/pdf' },
    ]);
    const sql = postgres(process.env.DATABASE_URL!);
    try {
      const count = async () =>
        Number(
          (
            await sql<
              { n: string }[]
            >`select count(*)::text as n from salary_archives`
          )[0].n,
        );
      const fields = {
        month: '2026-10',
        salary: '1000',
        totalExpenses: '0',
        totalSpendings: '0',
        spendings: [],
      };
      const forged = async (api: E2eApi) => {
        const s = sessions.get(api)!;
        const form = new FormData();
        for (const [k, v] of Object.entries(fields))
          form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
        form.append(
          'payslip',
          new Blob([FAKE_PDF], { type: 'application/pdf' }),
          'f.pdf',
        );
        const before = await count();
        const res = await fetch(`${api.url}/salary-archives`, {
          method: 'POST',
          headers: { Cookie: s.cookie, 'X-CSRF-Token': s.csrf },
          body: form,
        });
        return { status: res.status, created: (await count()) - before };
      };
      const n = await forged(nest);
      const h = await forged(hono);
      expect(n).toEqual({ status: 400, created: 1 }); // le bug reproduit côté Nest
      expect(h.status).toBe(n.status);
      // Écart voulu : Nest crée l'archive avant de refuser le fichier, Hono n'écrit rien.
      expect(h.created).toBe(0);
    } finally {
      await sql.end();
    }
  });

  describe('compte démo', () => {
    const sql = postgres(process.env.DATABASE_URL!);
    let demoId: string | undefined;
    afterAll(async () => {
      if (demoId) await sql`delete from users where id = ${demoId}`;
      await sql.end();
    });

    it('upload d’avatar refusé à la session démo partagée', async () => {
      const existing =
        await sql`select 1 from users where is_demo_account = true limit 1`;
      if (existing.length > 0) return; // base pourvue d'un vrai compte démo : on n'y touche pas
      const [u] = await sql<{ id: string }[]>`
        insert into users (email, display_name, is_demo_account, email_verified)
        values (${`demo-upl-${Date.now()}@dashflow.test`}, 'Démo', true, now()) returning id`;
      demoId = u.id;
      const [dn, dh] = await Promise.all(
        [nest, hono].map(async (api) => {
          const res = await fetch(`${api.url}/auth/demo-login`, {
            method: 'POST',
          });
          const { csrfToken } = (await res.json()) as { csrfToken: string };
          return {
            cookie: res.headers
              .getSetCookie()
              .map((c) => c.split(';')[0])
              .join('; '),
            csrf: csrfToken,
          };
        }),
      );
      const parts = [{ field: 'file', bytes: PNG, type: 'image/png' }];
      const [a, b] = await Promise.all([
        post(nest, dn, '/auth/me/avatar', parts),
        post(hono, dh, '/auth/me/avatar', parts),
      ]);
      expect(a.status).toBe(403);
      expect(b).toEqual(a);
    });
  });
});
