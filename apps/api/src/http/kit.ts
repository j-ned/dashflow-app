import type { Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, setCookie } from 'hono/cookie';
import type { CookieOptions } from 'hono/utils/cookie';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { AppError, BadRequestError } from '../common/errors';
import { NEXT_CURSOR_HEADER, type Page } from '../common/crud/keyset';
import type { Result } from '../auth/auth.result';
import {
  type CookieSettings,
  SESSION_COOKIE_NAMES,
  sessionCookieName,
  sessionCookieOptions,
} from '../auth/cookie';
import type { TokenService } from '../auth/token.service';
import type { CsrfService } from '../auth/csrf.service';
import type {
  ClientContext,
  SecurityEventsService,
} from '../security-events/security-events.service';
import type { SecurityEventOptions } from '../security-events/security-event-options';
import type { AppEnv } from './types';
import { rawJsonBody } from './validate';

/** Échec du Result pattern → erreur HTTP (même corps que `httpFrom` sous Nest). */
export function resultError(
  r: Extract<Result<unknown>, { success: false }>,
): AppError {
  return new AppError(r.status, r.error, r.code, r.details);
}

const UUID = z.string().uuid();

/** Paramètre de chemin UUID, comme `ParseUUIDPipe` (même message de refus). */
export function uuidParam(c: Context, name: string): string {
  const parsed = UUID.safeParse(c.req.param(name));
  if (!parsed.success)
    throw new BadRequestError('Validation failed (uuid is expected)');
  return parsed.data;
}

/** Page de résultats : en-tête de curseur suivant + éléments (comme `sendPage`). */
export function sendPage<T>(c: Context, page: Page<T>): T[] {
  if (page.nextCursor) c.header(NEXT_CURSOR_HEADER, page.nextCursor);
  return page.items;
}

export const clientOf = (c: Context<AppEnv>): ClientContext => ({
  ip: c.get('clientIp'),
  userAgent: c.req.header('user-agent') ?? null,
});

/** Réglages applicatifs (`maxAge` en ms) → options Hono (`Max-Age` en s + `Expires`). */
function honoCookieOptions(opts: Partial<CookieSettings>): CookieOptions {
  return {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite === 'strict' ? 'Strict' : 'Lax',
    path: opts.path,
    ...(opts.maxAge !== undefined
      ? {
          maxAge: Math.floor(opts.maxAge / 1000),
          expires: new Date(Date.now() + opts.maxAge),
        }
      : {}),
  };
}

export function setAppCookie(
  c: Context,
  name: string,
  value: string,
  opts: Partial<CookieSettings>,
): void {
  setCookie(c, name, value, honoCookieOptions(opts));
}

export function clearAppCookie(
  c: Context,
  name: string,
  opts: Partial<CookieSettings>,
): void {
  const { maxAge: _maxAge, ...rest } = opts;
  deleteCookie(c, name, honoCookieOptions(rest));
}

/** Sessions : signe le JWT, pose le cookie et rend le jeton CSRF de cette session. */
export class SessionCookies {
  constructor(
    private readonly tokens: TokenService,
    private readonly csrf: CsrfService,
    private readonly isProd: boolean,
  ) {}

  async open(
    c: Context,
    user: { id: string; email: string; sessionVersion: number },
    opts: { demo?: boolean } = {},
  ): Promise<string> {
    const jwt = await this.tokens.sign({
      sub: user.id,
      email: user.email,
      sv: user.sessionVersion,
      ...(opts.demo ? { demo: true as const } : {}),
    });
    setAppCookie(
      c,
      sessionCookieName(this.isProd),
      jwt,
      sessionCookieOptions(this.isProd),
    );
    return this.csrf.tokenFor(user.id, user.sessionVersion);
  }

  clear(c: Context): void {
    for (const name of SESSION_COOKIE_NAMES) {
      // `__Host-` n'est accepté par le navigateur (et par Hono) qu'avec Secure.
      if (name.startsWith('__Host-') && !this.isProd) continue;
      clearAppCookie(c, name, sessionCookieOptions(this.isProd));
    }
  }
}

/**
 * Fichier d'un envoi multipart (champ `field`), plafonné à `maxBytes` AVANT lecture complète :
 * au-delà → 413 « File too large » (message de multer sous Nest). Absent → `undefined`.
 */
export const uploadLimit = (maxBytes: number) =>
  bodyLimit({
    // Marge pour l'enveloppe multipart et les champs texte.
    maxSize: maxBytes + 64 * 1024,
    onError: () => {
      throw new AppError(413, 'File too large');
    },
  });

export type UploadedFile = {
  readonly buffer: Buffer;
  readonly mimetype: string;
  readonly originalname: string;
  readonly size: number;
};

export async function uploadedFile(
  c: Context,
  field: string,
  maxBytes: number,
): Promise<{ file?: UploadedFile; fields: Record<string, string> }> {
  if (!c.req.header('content-type')?.startsWith('multipart/form-data'))
    return { fields: {} };
  const form = await c.req.parseBody({ all: true });
  const fields: Record<string, string> = {};
  let value: File | undefined;
  for (const [name, entry] of Object.entries(form)) {
    const entries = Array.isArray(entry) ? entry : [entry];
    for (const v of entries) {
      if (typeof v === 'string') {
        fields[name] = v;
        continue;
      }
      // Comme multer `single(field)` : tout autre fichier, ou un second, est refusé.
      if (name !== field || value)
        throw new BadRequestError('Unexpected field');
      value = v;
    }
  }
  if (!value) return { fields };
  if (value.size > maxBytes) throw new AppError(413, 'File too large');
  return {
    fields,
    file: {
      buffer: Buffer.from(await value.arrayBuffer()),
      // Comme multer : le type déclaré par le client (vérifié ensuite par magic-bytes).
      mimetype: value.type || 'application/octet-stream',
      originalname: value.name,
      size: value.size,
    },
  };
}

/**
 * Journal d'événements de sécurité d'une route (équivalent de SecurityEventsInterceptor) :
 * utilisateur pris dans la session, sinon dans la réponse (`{ user: { id } }` d'un login), sinon
 * via l'e-mail du corps. Échecs journalisés sur 4xx (hors 429). Sessions démo ignorées.
 */
export const securityEvent = (
  events: SecurityEventsService,
  opts: SecurityEventOptions,
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    await next();
    const user = c.get('user');
    if (user?.isDemo) return;
    const client = clientOf(c);
    const email = async () =>
      ((await rawJsonBody(c).catch(() => ({}))) as { email?: unknown })?.email;

    if (c.error) {
      if (!opts.failure || !(c.error instanceof AppError)) return;
      const status = c.error.status;
      if (status < 400 || status >= 500 || status === 429) return;
      if (user?.id) await events.record(opts.failure, user.id, client);
      else await events.recordForEmail(opts.failure, await email(), client);
      return;
    }

    const body = (await c.res
      .clone()
      .json()
      .catch(() => null)) as {
      user?: { id?: unknown };
      backupCodesRemaining?: unknown;
      mfaRequired?: boolean;
    } | null;
    const fromBody = body?.user?.id;
    const userId =
      user?.id ?? (typeof fromBody === 'string' ? fromBody : undefined);
    if (userId) {
      await events.record(opts.success, userId, client);
      // Connexion par code de secours : événement à part, l'utilisateur doit le voir.
      if (body?.backupCodesRemaining !== undefined)
        await events.record('backup_code_used', userId, client);
      return;
    }
    // Ex. reset-password : pas de session, la réponse ne porte pas l'utilisateur.
    // Un login « mfa_required » n'a pas encore d'utilisateur : rien à journaliser.
    if (body?.mfaRequired) return;
    await events.recordForEmail(opts.success, await email(), client);
  });
