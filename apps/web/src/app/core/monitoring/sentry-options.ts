import type { BrowserOptions } from '@sentry/angular';

/**
 * Commit déployé, injecté par la build de production (`ng build --define SENTRY_RELEASE=…`, cf.
 * apps/web/Dockerfile). Absent des builds locales et des tests : `typeof` ne lève pas sur un
 * identifiant non défini.
 */
declare const SENTRY_RELEASE: string | undefined;

export const buildRelease = (): string | undefined =>
  typeof SENTRY_RELEASE === 'string' && SENTRY_RELEASE !== '' ? SENTRY_RELEASE : undefined;

/**
 * Options de Sentry côté navigateur. App E2EE (santé, budget) : rien qui identifie un visiteur ou
 * porte ses données. La release relie chaque erreur au commit déployé et à ses source maps
 * (envoyées par la build, jamais servies au public).
 */
export function sentryOptions(config: {
  readonly dsn: string;
  readonly production: boolean;
  readonly release?: string;
}): BrowserOptions {
  return {
    dsn: config.dsn,
    environment: config.production ? 'production' : 'development',
    ...(config.release ? { release: config.release } : {}),
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
  };
}
