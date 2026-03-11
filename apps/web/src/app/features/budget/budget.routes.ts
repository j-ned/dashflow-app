import { Routes } from '@angular/router';
import { BudgetDashboard } from './pages/budget-dashboard/budget-dashboard';
import { Envelopes } from './pages/envelopes/envelopes';
import { Loans } from './pages/loans/loans';
import { BankAccount } from './pages/bank-account/bank-account';
import { SalaryArchives } from './pages/salary-archives/salary-archives';
import { BudgetAnalytics } from './pages/budget-analytics/budget-analytics';

export const BUDGET_ROUTES: Routes = [
  { path: 'dashboard', component: BudgetDashboard },
  { path: 'envelopes', component: Envelopes },
  { path: 'loans', component: Loans },
  { path: 'account', component: BankAccount },
  { path: 'archives', component: SalaryArchives },
  { path: 'analytics', component: BudgetAnalytics },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
