import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { RecurringEntriesController } from './recurring-entries.controller';
import { RecurringEntriesService } from './recurring-entries.service';

@Module({
  imports: [AuthModule],
  controllers: [RecurringEntriesController],
  providers: [RecurringEntriesService],
})
export class RecurringEntriesModule {}
