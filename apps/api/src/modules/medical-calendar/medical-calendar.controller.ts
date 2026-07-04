import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CalendarService } from './calendar.service';

@Controller('medical/calendar')
export class MedicalCalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get(':token')
  async feed(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    const ical = await this.calendar.feed(token);
    if (ical === null) throw new NotFoundException('Token invalide');
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="medical.ics"');
    res.send(ical);
  }
}
