import { SetMetadata } from '@nestjs/common';
import type { SecurityEventType } from '../db/schema';

export const SECURITY_EVENT_KEY = 'security_event';

export type SecurityEventOptions = {
  /** Journalisé quand le handler répond avec succès. */
  success: SecurityEventType;
  /** Journalisé quand le handler lève un 4xx ; attribué via `req.body.email` si pas de session. */
  failure?: SecurityEventType;
};

/** À poser sur une route d'auth ; l'intercepteur SecurityEventsInterceptor fait le reste. */
export const SecurityEvent = (opts: SecurityEventOptions) =>
  SetMetadata(SECURITY_EVENT_KEY, opts);
