import { Module } from '@nestjs/common';
import { SecurityEventsModule } from '../security-events/security-events.module';
import { AdminModule } from '../modules/admin/admin.module';
import { DemoModule } from '../modules/demo/demo.module';
import { ScheduledJobs } from './scheduled-jobs';

@Module({
  imports: [SecurityEventsModule, AdminModule, DemoModule],
  providers: [ScheduledJobs],
})
export class SchedulerModule {}
