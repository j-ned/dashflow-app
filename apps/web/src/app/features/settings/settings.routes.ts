import { Routes } from '@angular/router';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/user-settings/user-settings').then(m => m.UserSettings),
  },
];
