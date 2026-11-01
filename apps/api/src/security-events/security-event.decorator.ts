import { SetMetadata } from '@nestjs/common';
import type { SecurityEventOptions } from './security-event-options';

export const SECURITY_EVENT_KEY = 'security_event';

export type { SecurityEventOptions };

/** À poser sur une route d'auth ; l'intercepteur SecurityEventsInterceptor fait le reste. */
export const SecurityEvent = (opts: SecurityEventOptions) =>
  SetMetadata(SECURITY_EVENT_KEY, opts);
