import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AccountTransactionsController } from './account-transactions.controller';
import { AccountTransactionsService } from './account-transactions.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [AccountTransactionsController],
  providers: [provideClass(AccountTransactionsService, DRIZZLE)],
})
export class AccountTransactionsModule {}
