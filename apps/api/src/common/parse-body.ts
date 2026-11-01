import type { ZodType } from 'zod';
import { BadRequestError } from './errors';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success)
    throw new BadRequestError(
      r.error.issues[0]?.message ?? 'Données invalides',
    );
  return r.data;
}
