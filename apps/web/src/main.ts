import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app';
import { startErrorReporting } from './app/core/monitoring/error-reporter';

bootstrapApplication(AppComponent, appConfig)
  .then(() => startErrorReporting())
  .catch((err: unknown) => console.error(err));
