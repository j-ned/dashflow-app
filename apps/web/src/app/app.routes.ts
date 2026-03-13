import { Routes } from '@angular/router';
import { AppShell } from './layout/app-shell/app-shell';
import { authGuard } from '@core/guards/auth.guard';
import { guestGuard } from '@core/guards/guest.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [guestGuard],
    loadComponent: () => import('./pages/landing/landing').then(m => m.Landing),
  },
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES),
  },
  {
    path: '',
    component: AppShell,
    canMatch: [authGuard],
    children: [
      { path: '', redirectTo: 'budget', pathMatch: 'full' },
      {
        path: 'budget',
        loadComponent: () => import('./layout/budget-layout/budget-layout').then(m => m.BudgetLayout),
        loadChildren: () => import('./features/budget/budget.routes').then(m => m.BUDGET_ROUTES),
      },
      {
        path: 'medical',
        loadComponent: () => import('./layout/medical-layout/medical-layout').then(m => m.MedicalLayout),
        loadChildren: () => import('./features/medical/medical.routes').then(m => m.MEDICAL_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
