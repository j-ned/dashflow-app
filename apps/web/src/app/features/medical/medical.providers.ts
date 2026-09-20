import { Provider } from '@angular/core';
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
import { DocumentGateway } from './domain/gateways/document.gateway';
import { HttpDocumentGateway } from './infra/http-document.gateway';
import { ReminderGateway } from './domain/gateways/reminder.gateway';
import { HttpReminderGateway } from './infra/http-reminder.gateway';

/**
 * Câblage gateway → implémentation HTTP, fourni au niveau des routes chargées à la demande : fourni à
 * la racine, il embarquait tous les gateways (et leurs schémas) dans le bundle initial.
 */
export const MEDICAL_GATEWAY_PROVIDERS: Provider[] = [
  { provide: PatientGateway, useClass: HttpPatientGateway },
  { provide: PractitionerGateway, useClass: HttpPractitionerGateway },
  { provide: AppointmentGateway, useClass: HttpAppointmentGateway },
  { provide: PrescriptionGateway, useClass: HttpPrescriptionGateway },
  { provide: MedicationGateway, useClass: HttpMedicationGateway },
  { provide: DocumentGateway, useClass: HttpDocumentGateway },
  { provide: ReminderGateway, useClass: HttpReminderGateway },
];
