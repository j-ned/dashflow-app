import { Routes } from '@angular/router';
import { AppShell } from './layout/app-shell/app-shell';
import { BudgetLayout } from './layout/budget-layout/budget-layout';
import { FreelanceLayout } from './layout/freelance-layout/freelance-layout';
import { authGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
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
        path: 'freelance',
        component: FreelanceLayout,
        loadChildren: () => import('./features/freelance/freelance.routes').then(m => m.FREELANCE_ROUTES),
      },
      {
        path: 'settings',
        loadChildren: () => import('./features/settings/settings.routes').then(m => m.SETTINGS_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: 'budget' },
];
