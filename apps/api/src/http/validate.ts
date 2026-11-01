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

/**
 * Corps JSON validé. Corps vide → `{}` (comme body-parser) ; JSON illisible → 400 générique,
 * sans recopier le message du parseur (l'API Nest exposait sa position d'erreur).
 */
export async function jsonBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  const raw = await c.req.text();
  let value: unknown = {};
  if (raw.trim() !== '') {
    try {
      value = JSON.parse(raw);
    } catch {
      throw new BadRequestError('Corps JSON invalide');
    }
  }
  return parseWith(schema, value);
}
