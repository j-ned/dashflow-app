import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { ConsumablesModule } from './modules/consumables/consumables.module';
import { EnvelopesModule } from './modules/envelopes/envelopes.module';
import { AccountTransactionsModule } from './modules/account-transactions/account-transactions.module';
import { LoansModule } from './modules/loans/loans.module';
import { RecurringEntriesModule } from './modules/recurring-entries/recurring-entries.module';
import { SalaryArchivesModule } from './modules/salary-archives/salary-archives.module';
import { PatientsModule } from './modules/patients/patients.module';
import { MembersModule } from './modules/members/members.module';
import { PractitionersModule } from './modules/practitioners/practitioners.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { MedicationsModule } from './modules/medications/medications.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { SharedAccessModule } from './modules/shared-access/shared-access.module';
import { MedicalCalendarModule } from './modules/medical-calendar/medical-calendar.module';
import { AdminModule } from './modules/admin/admin.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    // Instrumentation Sentry (contexte requête sur les événements). Inerte si SENTRY_DSN absent.
    SentryModule.forRoot(),
    ConfigModule,
    DrizzleModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 900_000, limit: 100 }]),
    MailModule,
    AuthModule,
    HealthModule,
    BankAccountsModule,
    ConsumablesModule,
    EnvelopesModule,
    AccountTransactionsModule,
    LoansModule,
    RecurringEntriesModule,
    SalaryArchivesModule,
    PatientsModule,
    MembersModule,
    PractitionersModule,
    AppointmentsModule,
    MedicationsModule,
    PrescriptionsModule,
    DocumentsModule,
    RemindersModule,
    SharedAccessModule,
    AdminModule,
    MedicalCalendarModule,
    StorageModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
