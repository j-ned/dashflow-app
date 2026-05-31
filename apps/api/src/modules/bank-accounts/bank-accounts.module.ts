import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { AuthModule } from '../../auth/auth.module';

@Module({ imports: [AuthModule], controllers: [BankAccountsController], providers: [BankAccountsService] })
export class BankAccountsModule {}
