import * as z from 'zod/mini';

export type ValidateCtx = { entity: string };

// Point d'extension télémétrie UNIQUE (YAGNI : log seul tant qu'il n'y a pas de cible réelle).
// On ne logge PAS la ligne déchiffrée (données en clair) : seuls l'entité et les `issues`
// (qui pointent le champ fautif via leur `path`) — hygiène E2EE.
function reportInvalid(ctx: ValidateCtx, issues: readonly z.core.$ZodIssue[]): void {
  console.error(`[E2EE] ${ctx.entity} : ligne déchiffrée invalide, exclue.`, issues);
}

// Liste : exclut + logge chaque ligne invalide, renvoie les valides.
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

// Unitaire : throw si invalide — exclure n'a pas de sens sur une ressource unique.
export function validateOne<T>(schema: z.core.$ZodType<T>, row: unknown, ctx: ValidateCtx): T {
  const res = z.safeParse(schema, row);
  if (res.success) return res.data;
  reportInvalid(ctx, res.error.issues);
  throw res.error;
}
