import { Routes } from '@angular/router';
import { BUDGET_GATEWAY_PROVIDERS } from '@features/budget/budget.providers';
import { guestGuard } from '@core/guards/guest';
import { sessionGuard } from '@core/guards/session';
import { Login } from './pages/login/login';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: Login, canMatch: [guestGuard] },
  {
    path: 'register',
    canMatch: [guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    path: 'forgot-password',
    canMatch: [guestGuard],
    loadComponent: () =>
      import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },
  {
    path: 'unlock',
    canMatch: [sessionGuard],
    loadComponent: () => import('./pages/unlock/unlock').then((m) => m.Unlock),
  },
  {
    path: 'onboarding',
    canMatch: [sessionGuard],
    // L'onboarding crée membres, compte et échéances : il lui faut les gateways du budget.
    providers: BUDGET_GATEWAY_PROVIDERS,
    loadComponent: () => import('./pages/onboarding/onboarding').then((m) => m.Onboarding),
  },
  {
    path: 'encryption-setup',
    canMatch: [sessionGuard],
    loadComponent: () =>
      import('./pages/encryption-setup/encryption-setup').then((m) => m.EncryptionSetup),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
