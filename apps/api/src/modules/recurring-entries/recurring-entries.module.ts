import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { StorageModule } from '../../storage/storage.module';
import { RecurringEntriesController } from './recurring-entries.controller';
import { RecurringEntriesService } from './recurring-entries.service';
import { StorageService } from '../../storage/storage.service';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [RecurringEntriesController],
  providers: [provideClass(RecurringEntriesService, DRIZZLE, StorageService)],
})
export class RecurringEntriesModule {}
