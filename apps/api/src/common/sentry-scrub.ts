import type { ErrorEvent } from '@sentry/node';

/** Fin du message d'une requête Drizzle en échec : `\nparams: <valeurs liées>`. */
const BOUND_PARAMS = /\nparams:[\s\S]*$/;

const scrub = (text: string | undefined): string | undefined =>
  text?.replace(BOUND_PARAMS, '\nparams: [retirés]');

/**
 * Dernier rempart avant l'envoi à Sentry (`beforeSend`) : retire les valeurs liées des requêtes
 * SQL de toute exception et du fil d'événements, même d'une erreur que l'application n'a pas
 * passée par describeError (auto-instrumentation, erreur non interceptée).
 */
export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  return {
    ...event,
    ...(event.exception?.values
      ? {
          exception: {
            ...event.exception,
            values: event.exception.values.map((v) => ({
              ...v,
              ...(v.value !== undefined ? { value: scrub(v.value) } : {}),
            })),
          },
        }
      : {}),
    ...(event.breadcrumbs
      ? {
          breadcrumbs: event.breadcrumbs.map((b) => ({
            ...b,
            ...(b.message !== undefined ? { message: scrub(b.message) } : {}),
          })),
        }
      : {}),
  };
}
