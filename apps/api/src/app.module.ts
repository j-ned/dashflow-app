import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DrizzleModule } from './db/drizzle.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { ConsumablesModule } from './modules/consumables/consumables.module';
import { EnvelopesModule } from './modules/envelopes/envelopes.module';
import { LoansModule } from './modules/loans/loans.module';
import { RecurringEntriesModule } from './modules/recurring-entries/recurring-entries.module';
import { SalaryArchivesModule } from './modules/salary-archives/salary-archives.module';

@Module({
  imports: [
    ConfigModule,
    DrizzleModule,
    ThrottlerModule.forRoot([{ ttl: 900_000, limit: 100 }]),
    MailModule,
    AuthModule,
    HealthModule,
    BankAccountsModule,
    ConsumablesModule,
    EnvelopesModule,
    LoansModule,
    RecurringEntriesModule,
    SalaryArchivesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
