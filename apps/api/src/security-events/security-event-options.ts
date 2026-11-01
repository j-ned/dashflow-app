import type { SecurityEventType } from '../db/schema';

export type SecurityEventOptions = {
  /** Journalisé quand le handler répond avec succès. */
  success: SecurityEventType;
  /** Journalisé quand le handler lève un 4xx ; attribué via `req.body.email` si pas de session. */
  failure?: SecurityEventType;
};
