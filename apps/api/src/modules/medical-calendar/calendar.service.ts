import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { sharedAccess, appointments, practitioners, medications } from '../../db/schema';
import { buildIcal } from './ical';

@Injectable()
export class CalendarService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async feed(token: string): Promise<string | null> {
    const [access] = await this.db.select().from(sharedAccess).where(eq(sharedAccess.calendarToken, token)).limit(1);
    if (!access) return null;
    const userId = access.userId;
    const [apts, practs, meds] = await Promise.all([
      this.db.select().from(appointments).where(eq(appointments.userId, userId)).limit(500),
      this.db.select().from(practitioners).where(eq(practitioners.userId, userId)).limit(500),
      this.db.select().from(medications).where(eq(medications.userId, userId)).limit(500),
    ]);
    return buildIcal(apts as never, practs as never, meds as never);
  }
}
