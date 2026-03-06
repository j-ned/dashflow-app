import { Routes } from '@angular/router';
import { FreelanceDashboard } from './pages/freelance-dashboard/freelance-dashboard';
import { Clients } from './pages/clients/clients';
import { Quotes } from './pages/quotes/quotes';
import { Invoices } from './pages/invoices/invoices';
import { Fiscal } from './pages/fiscal/fiscal';

export const FREELANCE_ROUTES: Routes = [
  { path: 'dashboard', component: FreelanceDashboard },
  { path: 'clients', component: Clients },
  { path: 'quotes', component: Quotes },
  { path: 'invoices', component: Invoices },
  { path: 'fiscal', component: Fiscal },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
