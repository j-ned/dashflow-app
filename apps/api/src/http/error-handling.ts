import * as Sentry from '@sentry/node';
import type { Context, Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { errorResponseBody, normalizeError } from '../common/error-response';
import { createLogger } from '../common/logger';

const logger = createLogger('HttpError');

/** Chemin + requête, comme `req.url` sous Express (champ `path` du corps d'erreur). */
function requestPath(c: Context): string {
  const url = new URL(c.req.url);
  return url.pathname + url.search;
}

/**
 * Corps d'erreur identique à celui du filtre Nest. Seules les 5xx partent à Sentry et aux logs :
 * les 4xx (401/404/409…) sont du bruit. Le détail d'une erreur inattendue ne sort jamais.
 */
export function installErrorHandling<E extends object>(app: Hono<E>): void {
  app.onError((err, c) => {
    const normalized = normalizeError(err);
    if (normalized.status >= 500) {
      Sentry.captureException(err);
      logger.error(
        err instanceof Error ? (err.stack ?? err.message) : String(err),
      );
    }
    return c.json(
      errorResponseBody(normalized, requestPath(c)),
      normalized.status as ContentfulStatusCode,
    );
  });
  app.notFound((c) =>
    c.json(
      errorResponseBody(
        { status: 404, message: `Cannot ${c.req.method} ${requestPath(c)}` },
        requestPath(c),
      ),
      404,
    ),
  );
}
