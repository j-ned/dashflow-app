import { ErrorHandler, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { buildRelease, sentryOptions } from './sentry-options';

type Sentry = typeof import('./sentry-client');
export type ErrorTags = Readonly<Record<string, string>>;

/**
 * Sentry pèse ~105 kB : il est chargé APRÈS le démarrage, hors du bundle initial. Les erreurs
 * signalées avant la fin du chargement attendent la même promesse, elles ne sont donc pas perdues.
 * Sans DSN (dev, tests) rien n'est chargé ni envoyé.
 */
let sentry: Promise<Sentry> | null = null;

function loadSentry(): Promise<Sentry> {
  sentry ??= import('./sentry-client').then((Sentry) => {
    Sentry.init(
      sentryOptions({
        dsn: environment.sentryDsn,
        production: environment.production,
        release: buildRelease(),
      }),
    );
    return Sentry;
  });
  return sentry;
}

/** À appeler une fois l'application démarrée. */
export function startErrorReporting(): void {
  if (!environment.sentryDsn) return;
  const start = () => void loadSentry().catch(() => undefined);
  if (typeof requestIdleCallback === 'function') requestIdleCallback(start, { timeout: 4000 });
  else setTimeout(start, 1500);
}

export function reportError(error: unknown, tags?: ErrorTags): void {
  if (!environment.sentryDsn) return;
  void loadSentry()
    .then((Sentry) => Sentry.captureException(error, tags ? { tags } : undefined))
    .catch(() => undefined);
}

/** Remplace `Sentry.createErrorHandler()` : même effet (console + envoi), sans import statique. */
@Injectable()
export class ReportingErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error(error);
    reportError(error);
  }
}
