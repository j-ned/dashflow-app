import { Module } from '@nestjs/common';
import { MedicalCalendarController } from './medical-calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  controllers: [MedicalCalendarController],
  providers: [CalendarService],
})
export class MedicalCalendarModule {}
