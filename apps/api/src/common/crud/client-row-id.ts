import { z } from 'zod';

const uuid = z.string().uuid();

/**
 * Id de ligne choisi par le client, accepté uniquement sur les créations chiffrées (E2EE).
 *
 * Le front lie chaque blob AES-GCM à sa ligne (données associées = id) ; il doit donc connaître
 * l'id avant d'envoyer la requête. Un id non-UUID ou hors E2EE est ignoré : le serveur génère.
 * Une collision de PK (id déjà pris) remonte en 409 via le mapping des erreurs Postgres.
 */
export function clientRowId(
  body: Record<string, unknown>,
): { id: string } | Record<never, never> {
  if (!body.encryptedData) return {};
  const parsed = uuid.safeParse(body.id);
  return parsed.success ? { id: parsed.data } : {};
}
