import { Routes } from '@angular/router';
import { MedicalDashboard } from './pages/medical-dashboard/medical-dashboard';
import { Patients } from './pages/patients/patients';
import { Practitioners } from './pages/practitioners/practitioners';
import { Appointments } from './pages/appointments/appointments';
import { Prescriptions } from './pages/prescriptions/prescriptions';
import { Medications } from './pages/medications/medications';
import { Documents } from './pages/documents/documents';
import { Reminders } from './pages/reminders/reminders';

export const MEDICAL_ROUTES: Routes = [
  { path: 'dashboard', component: MedicalDashboard },
  { path: 'patients', component: Patients },
  { path: 'practitioners', component: Practitioners },
  { path: 'appointments', component: Appointments },
  { path: 'prescriptions', component: Prescriptions },
  { path: 'documents', component: Documents },
  { path: 'medications', component: Medications },
  { path: 'reminders', component: Reminders },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
