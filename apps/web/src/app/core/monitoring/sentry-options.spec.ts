import { describe, expect, it } from 'vitest';
import { environment as prod } from '@env/environment.prod';
import { buildRelease, sentryOptions } from './sentry-options';

describe('sentryOptions', () => {
  const DSN = 'https://cle@o1.ingest.de.sentry.io/42';

  it('relie chaque erreur au commit déployé quand la build fournit une release', () => {
    const options = sentryOptions({ dsn: DSN, production: true, release: 'abc123' });

    expect(options).toMatchObject({ dsn: DSN, environment: 'production', release: 'abc123' });
  });

  it('sans release fournie (build locale) : aucune release envoyée', () => {
    expect(sentryOptions({ dsn: DSN, production: false }).release).toBeUndefined();
    expect(sentryOptions({ dsn: DSN, production: false }).environment).toBe('development');
  });

  it('ne collecte ni identité, ni corps, ni cookies, ni en-têtes, ni paramètres d’URL', () => {
    expect(sentryOptions({ dsn: DSN, production: true }).dataCollection).toEqual({
      userInfo: false,
      httpBodies: [],
      cookies: false,
      httpHeaders: { request: false, response: false },
      queryParams: false,
    });
  });

  it('ignore les messages de la console, qui peuvent porter une donnée déchiffrée', () => {
    const { beforeBreadcrumb } = sentryOptions({ dsn: DSN, production: true });

    expect(beforeBreadcrumb?.({ category: 'console', message: 'secret' })).toBeNull();
    expect(beforeBreadcrumb?.({ category: 'navigation' })).toEqual({ category: 'navigation' });
  });
});

describe('buildRelease', () => {
  it('build sans --define (tests, dev) : pas de release', () => {
    expect(buildRelease()).toBeUndefined();
  });
});

describe('DSN de production', () => {
  it('vise le projet Sentry dashflow-app-angular (4512436840300624), pas l’ancien projet', () => {
    expect(prod.sentryDsn).toMatch(/\.ingest\.de\.sentry\.io\/4512436840300624$/);
  });
});
