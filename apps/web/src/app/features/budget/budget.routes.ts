import { Routes } from '@angular/router';
import { BudgetDashboard } from './pages/budget-dashboard/budget-dashboard';
import { Envelopes } from './pages/envelopes/envelopes';
import { Loans } from './pages/loans/loans';
import { Consumables } from './pages/consumables/consumables';

export const BUDGET_ROUTES: Routes = [
  { path: 'dashboard', component: BudgetDashboard },
  { path: 'envelopes', component: Envelopes },
  { path: 'loans', component: Loans },
  { path: 'consumables', component: Consumables },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
