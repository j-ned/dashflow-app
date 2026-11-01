import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';
import { AuthModule } from '../../auth/auth.module';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [BankAccountsController],
  providers: [provideClass(BankAccountsService, DRIZZLE)],
})
export class BankAccountsModule {}
