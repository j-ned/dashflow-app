import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { startApi, type E2eApi } from './e2e/api-server';
import { authKey } from './auth-key';
import { UPLOAD_MULTER_LIMIT_BYTES } from '../src/common/files/validate-upload';

/**
 * Envois multipart de bout en bout. Sans stockage R2 configuré, on couvre tout ce qui précède
 * l'écriture : gardes, plafond de taille, nom de champ, magic-bytes, ressource inconnue — et, pour
 * un fichier valide, le 503 du stockage absent. Les attendus sont ceux de l'API NestJS (relevés
 * par une comparaison Nest/Hono), sauf les deux écarts voulus signalés.
 */
const AVATAR_LIMIT = 2 * 1024 * 1024;

// PNG 1×1 réel (avec IHDR) : reconnu par file-type, contrairement à une simple signature.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const PDF = Buffer.from(
  '%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
);
const FAKE = Buffer.from('ceci n’est pas un pdf');

type Session = { cookie: string; csrf: string };
type Part = { field: string; bytes: Buffer; type: string };

const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

async function session(api: E2eApi): Promise<Session> {
  const email = `upl+${Date.now()}-${Math.floor(Math.random() * 1e6)}@dashflow.test`;
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
  return { cookie: cookieOf(verify), csrf: csrfToken };
}

async function post(
  api: E2eApi,
  s: Session,
  path: string,
  parts: Part[] | 'json',
) {
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
        new Blob([new Uint8Array(p.bytes)], { type: p.type }),
        'f.bin',
      );
    body = form;
  }
  const res = await fetch(api.url + path, { method: 'POST', headers, body });
  return {
    status: res.status,
    message: ((await res.json()) as { message?: string }).message,
  };
}

describe('Uploads multipart (e2e)', () => {
  let api: E2eApi;
  let user: Session;
  const unknownId = randomUUID();

  beforeAll(async () => {
    // Démo active : le cas « compte démo » ouvre une session via /auth/demo-login.
    api = await startApi({ env: { DEMO_ENABLED: 'true' } });
    user = await session(api);
  });
  afterAll(async () => {
    await api?.stop();
  });

  const IMAGE_INVALID = "Contenu de l'image invalide (type réel non autorisé)";
  const FILE_INVALID = 'Contenu du fichier invalide (type réel non autorisé)';
  const ROUTES: [
    string,
    string,
    number,
    Part,
    string,
    { status: number; message: string },
  ][] = [
    [
      '/auth/me/avatar',
      'file',
      AVATAR_LIMIT,
      { field: 'file', bytes: PNG, type: 'image/png' },
      IMAGE_INVALID,
      { status: 503, message: 'Stockage R2 non configuré' },
    ],
    [
      `/documents/${unknownId}/file`,
      'file',
      UPLOAD_MULTER_LIMIT_BYTES,
      { field: 'file', bytes: PDF, type: 'application/pdf' },
      FILE_INVALID,
      { status: 404, message: 'Non trouvé' },
    ],
    [
      `/prescriptions/${unknownId}/document`,
      'document',
      UPLOAD_MULTER_LIMIT_BYTES,
      { field: 'document', bytes: PDF, type: 'application/pdf' },
      FILE_INVALID,
      { status: 404, message: 'Non trouvé' },
    ],
    [
      `/recurring-entries/${unknownId}/payslip`,
      'payslip',
      UPLOAD_MULTER_LIMIT_BYTES,
      { field: 'payslip', bytes: PDF, type: 'application/pdf' },
      FILE_INVALID,
      { status: 404, message: 'Non trouvé' },
    ],
    [
      `/salary-archives/${unknownId}/payslip`,
      'payslip',
      UPLOAD_MULTER_LIMIT_BYTES,
      { field: 'payslip', bytes: PDF, type: 'application/pdf' },
      FILE_INVALID,
      { status: 404, message: 'Non trouvé' },
    ],
  ];

  describe.each(ROUTES)(
    '%s',
    (path, field, limit, valid, invalidMessage, validOutcome) => {
      it('sans fichier → 400 « Fichier requis »', async () => {
        expect(await post(api, user, path, 'json')).toEqual({
          status: 400,
          message: 'Fichier requis',
        });
      });
      it('fichier sous un autre nom de champ → 400 « Unexpected field » (Nest : 500, erreur multer non traduite)', async () => {
        expect(
          await post(api, user, path, [{ ...valid, field: 'autre' }]),
        ).toEqual({
          status: 400,
          message: 'Unexpected field',
        });
      });
      it('deux fichiers pour le même champ → 400 « Unexpected field »', async () => {
        expect(await post(api, user, path, [valid, valid])).toEqual({
          status: 400,
          message: 'Unexpected field',
        });
      });
      it('au-delà du plafond → 413 « File too large »', async () => {
        const big = Buffer.concat([
          valid.bytes,
          Buffer.alloc(limit + 1 - valid.bytes.length),
        ]);
        expect(
          await post(api, user, path, [
            { field, bytes: big, type: valid.type },
          ]),
        ).toEqual({
          status: 413,
          message: 'File too large',
        });
      });
      it('contenu falsifié (magic-bytes) → 400', async () => {
        expect(
          await post(api, user, path, [
            { field, bytes: FAKE, type: valid.type },
          ]),
        ).toEqual({
          status: 400,
          message: invalidMessage,
        });
      });
      it('fichier valide → ressource inconnue (404) ou stockage absent (503)', async () => {
        expect(await post(api, user, path, [valid])).toEqual(validOutcome);
      });
    },
  );

  it('création d’archive avec fichier falsifié : 400 et AUCUNE ligne écrite (Nest créait l’archive)', async () => {
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
      const form = new FormData();
      for (const [k, v] of Object.entries({
        month: '2026-10',
        salary: '1000',
        spendings: '[]',
      }))
        form.append(k, v);
      form.append(
        'payslip',
        new Blob([FAKE], { type: 'application/pdf' }),
        'f.pdf',
      );
      const before = await count();
      const res = await fetch(`${api.url}/salary-archives`, {
        method: 'POST',
        headers: { Cookie: user.cookie, 'X-CSRF-Token': user.csrf },
        body: form,
      });
      expect(res.status).toBe(400);
      expect(await count()).toBe(before);
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

    it('upload d’avatar refusé (403) à la session démo partagée', async () => {
      const existing =
        await sql`select 1 from users where is_demo_account = true limit 1`;
      if (existing.length > 0) return; // base pourvue d'un vrai compte démo : on n'y touche pas
      const [u] = await sql<{ id: string }[]>`
        insert into users (email, display_name, is_demo_account, email_verified)
        values (${`demo-upl-${Date.now()}@dashflow.test`}, 'Démo', true, now()) returning id`;
      demoId = u.id;
      const res = await fetch(`${api.url}/auth/demo-login`, { method: 'POST' });
      const { csrfToken } = (await res.json()) as { csrfToken: string };
      expect(
        await post(
          api,
          { cookie: cookieOf(res), csrf: csrfToken },
          '/auth/me/avatar',
          [{ field: 'file', bytes: PNG, type: 'image/png' }],
        ),
      ).toEqual({
        status: 403,
        message: 'Action indisponible sur le compte démo',
      });
    });
  });
});
