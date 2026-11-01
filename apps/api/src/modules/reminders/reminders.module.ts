import { Module } from '@nestjs/common';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
