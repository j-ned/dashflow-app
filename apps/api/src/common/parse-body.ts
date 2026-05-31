import { BadRequestException } from '@nestjs/common';
import type { ZodType } from 'zod';

export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.issues[0]?.message ?? 'Données invalides');
  return r.data;
}
