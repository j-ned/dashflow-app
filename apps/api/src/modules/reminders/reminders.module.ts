import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { AuthModule } from '../../auth/auth.module';
import { provideClass } from '../../common/nest/provide-class';
import { DRIZZLE } from '../../db/drizzle.constants';

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [provideClass(RemindersService, DRIZZLE)],
})
export class RemindersModule {}
