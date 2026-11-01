import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { BadRequestError } from '../common/errors';

/** Même règle que ZodValidationPipe : premier message Zod, sinon « Données invalides ». */
export function parseWith<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new BadRequestError(
      result.error.issues[0]?.message ?? 'Données invalides',
    );
  return result.data;
}

/** `application/json` (paramètres ignorés), seul type que body-parser lisait sous Nest. */
const isJson = (contentType: string | undefined): boolean =>
  contentType?.split(';')[0]?.trim().toLowerCase() === 'application/json';

/**
 * Corps JSON brut, comme `@Body()` sous Nest : `{}` si le corps est vide OU s'il n'est pas
 * déclaré `application/json`. Ce dernier point est une protection : un formulaire `text/plain`
 * posté depuis un autre site (sans preflight CORS) ne doit pas être lu comme du JSON — sinon
 * « login CSRF » sur /auth/login. JSON illisible → 400 générique, sans recopier le message du
 * parseur (l'API Nest exposait sa position d'erreur).
 */
export async function rawJsonBody(c: Context): Promise<unknown> {
  if (!isJson(c.req.header('content-type'))) return {};
  const raw = await c.req.text();
  if (raw.trim() === '') return {};
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new BadRequestError('Corps JSON invalide');
  }
}

/** Corps JSON validé par `schema` (cf. rawJsonBody). */
export async function jsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  return parseWith(schema, await rawJsonBody(c));
}

/** Objet JSON brut, pour les routes qui le valident elles-mêmes (comme `@Body() body`). */
export async function jsonObject(c: Context): Promise<Record<string, unknown>> {
  const value = await rawJsonBody(c);
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
