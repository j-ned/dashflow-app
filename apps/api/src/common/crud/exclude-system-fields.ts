/**
 * Retire les colonnes système non patchables (`id`, `userId`, `createdAt`) d'un body
 * d'update en clair, avant de le passer au repository.
 */
const SYSTEM_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'userId',
  'createdAt',
]);

export function excludeSystemFields(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([key]) => !SYSTEM_FIELDS.has(key)),
  );
}
