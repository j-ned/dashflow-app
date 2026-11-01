import { bodyLimit } from 'hono/body-limit';
import { createMiddleware } from 'hono/factory';
import { PayloadTooLargeError } from '../errors';

/** Plafond par défaut des corps non multipart : 100 Ko, comme body-parser sous Express. */
export const DEFAULT_BODY_LIMIT_BYTES = 100 * 1024;

/**
 * Hono n'impose AUCUNE limite par défaut : sans ce middleware, un corps de plusieurs Go serait
 * lu en mémoire. Les envois multipart (fichiers) ont leur propre plafond, posé par route.
 * Dépassement → 413 (l'API Nest répondait 500 : l'erreur de body-parser n'était pas traduite).
 */
export const defaultBodyLimit = () => {
  const limit = bodyLimit({
    maxSize: DEFAULT_BODY_LIMIT_BYTES,
    onError: () => {
      throw new PayloadTooLargeError();
    },
  });
  return createMiddleware(async (c, next) => {
    if (c.req.header('content-type')?.startsWith('multipart/form-data'))
      return next();
    return limit(c, next);
  });
};
