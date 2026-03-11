import { Routes } from '@angular/router';
import { Login } from './pages/login/login';

export const AUTH_ROUTES: Routes = [
  { path: 'login', component: Login },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register').then(m => m.Register),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password').then(m => m.ForgotPassword),
  },
  {
    path: 'unlock',
    loadComponent: () => import('./pages/unlock/unlock').then(m => m.Unlock),
  },
  {
    path: 'encryption-setup',
    loadComponent: () => import('./pages/encryption-setup/encryption-setup').then(m => m.EncryptionSetup),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
