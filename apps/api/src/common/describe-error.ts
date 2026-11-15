import { DrizzleQueryError } from 'drizzle-orm';

/**
 * Message d'erreur destiné aux journaux et à Sentry. Une requête SQL en échec garde sa requête
 * paramétrée et la cause Postgres, jamais ses valeurs liées : Drizzle les met dans le message
 * (`Failed query: … params: …`), et ce sont des données d'utilisateurs (e-mails, hashes, et des
 * données de santé ou de budget sur la démo et les comptes non chiffrés).
 */
export function describeError(err: unknown): string {
  if (err instanceof DrizzleQueryError) {
    const cause =
      err.cause instanceof Error ? err.cause.message : 'cause inconnue';
    return `Requête SQL en échec (${cause}) : ${err.query}`;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Pile d'appels sûre à journaliser : le message de describeError, puis les lignes `at …`. */
export function errorStack(err: unknown): string {
  const frames =
    err instanceof Error && err.stack
      ? err.stack.split('\n').filter((l) => /^\s+at /.test(l))
      : [];
  const name = err instanceof Error ? err.name : 'Error';
  return [`${name}: ${describeError(err)}`, ...frames].join('\n');
}
