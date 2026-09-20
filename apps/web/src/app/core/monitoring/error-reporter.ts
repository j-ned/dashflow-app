import { ErrorHandler, Injectable } from '@angular/core';
import { environment } from '@env/environment';

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
    Sentry.init({
      dsn: environment.sentryDsn,
      environment: environment.production ? 'production' : 'development',
      sendDefaultPii: false,
      dataCollection: {
        userInfo: false,
        httpBodies: [],
        cookies: false,
        httpHeaders: { request: false, response: false },
        queryParams: false,
      },
      // Un console.error/warn peut porter une donnée E2EE déchiffrée (cf. validate-decrypted.ts) ; le
      // breadcrumb par défaut de Sentry capture les arguments bruts des logs console, donc on les exclut
      // sans toucher aux autres intégrations par défaut (dedupe, linkedErrors, httpContext...).
      beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
    });
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
