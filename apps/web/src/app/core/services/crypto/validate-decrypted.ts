import * as z from 'zod/mini';

export type ValidateCtx = { entity: string };

function reportInvalid(ctx: ValidateCtx, issues: readonly z.core.$ZodIssue[]): void {
  console.error(`[E2EE] ${ctx.entity} : ligne déchiffrée invalide, exclue.`, issues);
}

export function validateList<T>(
  schema: z.core.$ZodType<T>,
  rows: readonly unknown[],
  ctx: ValidateCtx,
): T[] {
  const valid: T[] = [];
  for (const row of rows) {
    const res = z.safeParse(schema, row);
    if (res.success) valid.push(res.data);
    else reportInvalid(ctx, res.error.issues);
  }
  return valid;
}

export function validateOne<T>(schema: z.core.$ZodType<T>, row: unknown, ctx: ValidateCtx): T {
  const res = z.safeParse(schema, row);
  if (res.success) return res.data;
  reportInvalid(ctx, res.error.issues);
  throw res.error;
}
