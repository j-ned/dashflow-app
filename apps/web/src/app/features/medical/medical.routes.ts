import { Routes } from '@angular/router';

export const MEDICAL_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/medical-dashboard/medical-dashboard').then(m => m.MedicalDashboard),
  },
  {
    path: 'patients',
    loadComponent: () => import('./pages/patients/patients').then(m => m.Patients),
  },
  {
    path: 'practitioners',
    loadComponent: () => import('./pages/practitioners/practitioners').then(m => m.Practitioners),
  },
  {
    path: 'appointments',
    loadComponent: () => import('./pages/appointments/appointments').then(m => m.Appointments),
  },
  {
    path: 'prescriptions',
    loadComponent: () => import('./pages/prescriptions/prescriptions').then(m => m.Prescriptions),
  },
  {
    path: 'documents',
    loadComponent: () => import('./pages/documents/documents').then(m => m.Documents),
  },
  {
    path: 'medications',
    loadComponent: () => import('./pages/medications/medications').then(m => m.Medications),
  },
  {
    path: 'reminders',
    loadComponent: () => import('./pages/reminders/reminders').then(m => m.Reminders),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
