import { bootstrapApplication } from '@angular/platform-browser';
import * as Sentry from '@sentry/angular';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';
import { environment } from '@env/environment';

if (environment.sentryDsn) {
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
    // Un console.error/warn peut porter une donnée E2EE déchiffrée (cf. validate-decrypted.ts) ; le breadcrumb
    // par défaut de Sentry capture les arguments bruts des logs console — on les exclut sans toucher aux
    // autres intégrations par défaut (dedupe, linkedErrors, httpContext...).
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
  });
}

bootstrapApplication(AppComponent, appConfig).catch((err: unknown) => console.error(err));
