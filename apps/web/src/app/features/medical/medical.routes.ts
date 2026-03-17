import { Routes } from '@angular/router';
import { PatientGateway } from './domain/gateways/patient.gateway';
import { HttpPatientGateway } from './infra/http-patient.gateway';
import { PractitionerGateway } from './domain/gateways/practitioner.gateway';
import { HttpPractitionerGateway } from './infra/http-practitioner.gateway';
import { AppointmentGateway } from './domain/gateways/appointment.gateway';
import { HttpAppointmentGateway } from './infra/http-appointment.gateway';
import { PrescriptionGateway } from './domain/gateways/prescription.gateway';
import { HttpPrescriptionGateway } from './infra/http-prescription.gateway';
import { MedicationGateway } from './domain/gateways/medication.gateway';
import { HttpMedicationGateway } from './infra/http-medication.gateway';
import { ReminderGateway } from './domain/gateways/reminder.gateway';
import { HttpReminderGateway } from './infra/http-reminder.gateway';
import { DocumentGateway } from './domain/gateways/document.gateway';
import { HttpDocumentGateway } from './infra/http-document.gateway';
import { SharedAccessGateway } from './domain/gateways/shared-access.gateway';
import { HttpSharedAccessGateway } from './infra/http-shared-access.gateway';

export const MEDICAL_ROUTES: Routes = [
  {
    path: '',
    providers: [
      { provide: PatientGateway, useClass: HttpPatientGateway },
      { provide: PractitionerGateway, useClass: HttpPractitionerGateway },
      { provide: AppointmentGateway, useClass: HttpAppointmentGateway },
      { provide: PrescriptionGateway, useClass: HttpPrescriptionGateway },
      { provide: MedicationGateway, useClass: HttpMedicationGateway },
      { provide: ReminderGateway, useClass: HttpReminderGateway },
      { provide: DocumentGateway, useClass: HttpDocumentGateway },
      { provide: SharedAccessGateway, useClass: HttpSharedAccessGateway },
    ],
    children: [
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
    ],
  },
];
