import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { sharedAccess, users } from '../../db/schema';
import { MAILER, type Mailer } from '../../mail/mailer';

type SharedAccess = typeof sharedAccess.$inferSelect;

@Injectable()
export class SharedAccessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  list(userId: string): Promise<SharedAccess[]> {
    return this.db.select().from(sharedAccess).where(eq(sharedAccess.userId, userId)).limit(100);
  }

  async create(userId: string, invitedEmail: string): Promise<SharedAccess> {
    const calendarToken = randomUUID().replace(/-/g, '').slice(0, 32);
    const [row] = await this.db.insert(sharedAccess).values({ userId, invitedEmail, calendarToken }).returning();
    const [user] = await this.db.select({ displayName: users.displayName, email: users.email })
      .from(users).where(eq(users.id, userId)).limit(1);
    const senderName = user?.displayName ?? user?.email ?? 'Un utilisateur DashFlow';
    void this.mailer.sendCalendarInvitation(invitedEmail, senderName, calendarToken).catch(() => undefined);
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.delete(sharedAccess).where(and(eq(sharedAccess.id, id), eq(sharedAccess.userId, userId)));
  }
}
