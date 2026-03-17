import { ApplicationConfig, LOCALE_ID } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import localeFr from '@angular/common/locales/fr';

registerLocaleData(localeFr);
import { routes } from './app.routes';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { HttpEnvelopeGateway } from '@features/budget/infra/http-envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { HttpLoanGateway } from '@features/budget/infra/http-loan.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { HttpMemberGateway } from '@features/budget/infra/http-member.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { HttpRecurringEntryGateway } from '@features/budget/infra/http-recurring-entry.gateway';
import { BankAccountGateway } from '@features/budget/domain/gateways/bank-account.gateway';
import { HttpBankAccountGateway } from '@features/budget/infra/http-bank-account.gateway';
import { SalaryArchiveGateway } from '@features/budget/domain/gateways/salary-archive.gateway';
import { HttpSalaryArchiveGateway } from '@features/budget/infra/http-salary-archive.gateway';
import { PatientGateway } from '@features/medical/domain/gateways/patient.gateway';
import { HttpPatientGateway } from '@features/medical/infra/http-patient.gateway';
import { PractitionerGateway } from '@features/medical/domain/gateways/practitioner.gateway';
import { HttpPractitionerGateway } from '@features/medical/infra/http-practitioner.gateway';
import { AppointmentGateway } from '@features/medical/domain/gateways/appointment.gateway';
import { HttpAppointmentGateway } from '@features/medical/infra/http-appointment.gateway';
import { PrescriptionGateway } from '@features/medical/domain/gateways/prescription.gateway';
import { HttpPrescriptionGateway } from '@features/medical/infra/http-prescription.gateway';
import { MedicationGateway } from '@features/medical/domain/gateways/medication.gateway';
import { HttpMedicationGateway } from '@features/medical/infra/http-medication.gateway';
import { ReminderGateway } from '@features/medical/domain/gateways/reminder.gateway';
import { HttpReminderGateway } from '@features/medical/infra/http-reminder.gateway';
import { DocumentGateway } from '@features/medical/domain/gateways/document.gateway';
import { HttpDocumentGateway } from '@features/medical/infra/http-document.gateway';
import { SharedAccessGateway } from '@features/medical/domain/gateways/shared-access.gateway';
import { HttpSharedAccessGateway } from '@features/medical/infra/http-shared-access.gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: 'fr' },
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({
        anchorScrolling: 'enabled',
        scrollPositionRestoration: 'enabled',
      }),
    ),
    provideHttpClient(withFetch()),

    { provide: EnvelopeGateway, useClass: HttpEnvelopeGateway },
    { provide: LoanGateway, useClass: HttpLoanGateway },
    { provide: MemberGateway, useClass: HttpMemberGateway },
    { provide: RecurringEntryGateway, useClass: HttpRecurringEntryGateway },
    { provide: BankAccountGateway, useClass: HttpBankAccountGateway },
    { provide: SalaryArchiveGateway, useClass: HttpSalaryArchiveGateway },

    { provide: PatientGateway, useClass: HttpPatientGateway },
    { provide: PractitionerGateway, useClass: HttpPractitionerGateway },
    { provide: AppointmentGateway, useClass: HttpAppointmentGateway },
    { provide: PrescriptionGateway, useClass: HttpPrescriptionGateway },
    { provide: MedicationGateway, useClass: HttpMedicationGateway },
    { provide: DocumentGateway, useClass: HttpDocumentGateway },
    { provide: ReminderGateway, useClass: HttpReminderGateway },
    { provide: SharedAccessGateway, useClass: HttpSharedAccessGateway },
  ],
};
