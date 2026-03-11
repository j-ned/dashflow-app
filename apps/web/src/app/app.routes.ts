import { inject } from '@angular/core';
import { CanMatchFn, Router, Routes } from '@angular/router';
import { AppShell } from './layout/app-shell/app-shell';
import { BudgetLayout } from './layout/budget-layout/budget-layout';
import { MedicalLayout } from './layout/medical-layout/medical-layout';
import { authGuard } from '@core/guards/auth.guard';
import { AuthStore } from '@features/auth/domain/auth.store';

const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  if (auth.isLoading()) await auth.checkSession();
  return auth.isAuthenticated() ? router.createUrlTree(['/budget']) : true;
};

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
        component: BudgetLayout,
        loadChildren: () => import('./features/budget/budget.routes').then(m => m.BUDGET_ROUTES),
      },
      {
        path: 'medical',
        component: MedicalLayout,
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
