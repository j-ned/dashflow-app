import { Routes } from '@angular/router';
import { BUDGET_GATEWAY_PROVIDERS } from './budget.providers';

export const BUDGET_ROUTES: Routes = [
  {
    path: '',
    providers: BUDGET_GATEWAY_PROVIDERS,
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/budget-dashboard/budget-dashboard').then((m) => m.BudgetDashboard),
      },
      {
        path: 'envelopes',
        loadComponent: () => import('./pages/envelopes/envelopes').then((m) => m.Envelopes),
      },
      {
        path: 'loans',
        loadComponent: () => import('./pages/loans/loans').then((m) => m.Loans),
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/bank-account/bank-account').then((m) => m.BankAccount),
      },
      {
        path: 'archives',
        loadComponent: () =>
          import('./pages/salary-archives/salary-archives').then((m) => m.SalaryArchives),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./pages/budget-analytics/budget-analytics').then((m) => m.BudgetAnalytics),
      },
      {
        path: 'transactions',
        loadComponent: () =>
          import('./pages/transactions/transactions').then((m) => m.Transactions),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
