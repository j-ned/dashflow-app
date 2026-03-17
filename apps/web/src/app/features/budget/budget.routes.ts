import { Routes } from '@angular/router';
import { EnvelopeGateway } from './domain/gateways/envelope.gateway';
import { HttpEnvelopeGateway } from './infra/http-envelope.gateway';
import { LoanGateway } from './domain/gateways/loan.gateway';
import { HttpLoanGateway } from './infra/http-loan.gateway';
import { MemberGateway } from './domain/gateways/member.gateway';
import { HttpMemberGateway } from './infra/http-member.gateway';
import { RecurringEntryGateway } from './domain/gateways/recurring-entry.gateway';
import { HttpRecurringEntryGateway } from './infra/http-recurring-entry.gateway';
import { BankAccountGateway } from './domain/gateways/bank-account.gateway';
import { HttpBankAccountGateway } from './infra/http-bank-account.gateway';
import { SalaryArchiveGateway } from './domain/gateways/salary-archive.gateway';
import { HttpSalaryArchiveGateway } from './infra/http-salary-archive.gateway';

export const BUDGET_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: EnvelopeGateway, useClass: HttpEnvelopeGateway },
      { provide: LoanGateway, useClass: HttpLoanGateway },
      { provide: MemberGateway, useClass: HttpMemberGateway },
      { provide: RecurringEntryGateway, useClass: HttpRecurringEntryGateway },
      { provide: BankAccountGateway, useClass: HttpBankAccountGateway },
      { provide: SalaryArchiveGateway, useClass: HttpSalaryArchiveGateway },
    ],
    children: [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/budget-dashboard/budget-dashboard').then(m => m.BudgetDashboard),
  },
  {
    path: 'envelopes',
    loadComponent: () => import('./pages/envelopes/envelopes').then(m => m.Envelopes),
  },
  {
    path: 'loans',
    loadComponent: () => import('./pages/loans/loans').then(m => m.Loans),
  },
  {
    path: 'account',
    loadComponent: () => import('./pages/bank-account/bank-account').then(m => m.BankAccount),
  },
  {
    path: 'archives',
    loadComponent: () => import('./pages/salary-archives/salary-archives').then(m => m.SalaryArchives),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./pages/budget-analytics/budget-analytics').then(m => m.BudgetAnalytics),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
];
