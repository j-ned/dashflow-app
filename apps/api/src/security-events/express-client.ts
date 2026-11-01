import type { Request } from 'express';
import type { ClientContext } from './security-events.service';

/** Contexte client d'une requête Express (`req.ip` tient compte de `trust proxy`). */
export function expressClient(req: Request): ClientContext {
  const ua = req.headers['user-agent'];
  return { ip: req.ip, userAgent: typeof ua === 'string' ? ua : null };
}
