import { ApplicationConfig, ErrorHandler, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { ReportingErrorHandler } from '@core/monitoring/error-reporter';
import { environment } from '@env/environment';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { credentialsInterceptor } from '@core/interceptors/credentials.interceptor';
import { csrfInterceptor } from '@core/interceptors/csrf.interceptor';
import localeFr from '@angular/common/locales/fr';
import localeEn from '@angular/common/locales/en';

registerLocaleData(localeFr);
registerLocaleData(localeEn);
import { routes } from './app.routes';
import { transloco, readInitialLang } from '@core/i18n/transloco.config';

const sentryProviders: ApplicationConfig['providers'] = environment.sentryDsn
  ? [{ provide: ErrorHandler, useClass: ReportingErrorHandler }]
  : [];

export const appConfig: ApplicationConfig = {
  providers: [
    ...sentryProviders,
    { provide: LOCALE_ID, useFactory: readInitialLang },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withPreloading(PreloadAllModules),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideHttpClient(withInterceptors([credentialsInterceptor, csrfInterceptor])),
    transloco,
  ],
};
