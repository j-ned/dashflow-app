import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { AccountTransactionsController } from './account-transactions.controller';
import { AccountTransactionsService } from './account-transactions.service';

@Module({
  imports: [AuthModule],
  controllers: [AccountTransactionsController],
  providers: [AccountTransactionsService],
})
export class AccountTransactionsModule {}
