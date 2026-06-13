import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { stripeEvents } from '../../db/schema';

@Injectable()
export class StripeEventsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Insère l'event ; renvoie false si déjà présent (déjà traité → ne pas rejouer). */
  async markProcessed(eventId: string, type: string): Promise<boolean> {
    const rows = await this.db
      .insert(stripeEvents)
      .values({ eventId, type })
      .onConflictDoNothing()
      .returning();
    return rows.length > 0;
  }
}
