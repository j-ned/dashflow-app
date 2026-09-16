import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, getTableColumns } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { sharedAccess, users } from '../../db/schema';
import { MAILER, type Mailer } from '../../mail/mailer';
import {
  afterCreatedAt,
  CURSOR_COLUMN,
  createdAtCursorText,
  pageLimit,
  toPageByCreatedAt,
  type Page,
  type PageQuery,
} from '../../common/crud/keyset';

type SharedAccess = typeof sharedAccess.$inferSelect;

/** Chaque partage déclenche un e-mail sortant : borne le volume qu'un seul compte peut générer. */
export const MAX_SHARED_ACCESS_PER_USER = 10;

@Injectable()
export class SharedAccessService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async list(userId: string, q: PageQuery = {}): Promise<Page<SharedAccess>> {
    const limit = pageLimit(q);
    const t = sharedAccess;
    const rows = await this.db
      .select({
        ...getTableColumns(t),
        [CURSOR_COLUMN]: createdAtCursorText(t.createdAt),
      })
      .from(t)
      .where(
        and(
          eq(t.userId, userId),
          afterCreatedAt(t.createdAt, t.id, q.after, 'asc'),
        ),
      )
      .orderBy(asc(t.createdAt), asc(t.id))
      .limit(limit + 1);
    return toPageByCreatedAt(rows, limit);
  }

  async create(userId: string, invitedEmail: string): Promise<SharedAccess> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(sharedAccess)
      .where(eq(sharedAccess.userId, userId));
    if (Number(total) >= MAX_SHARED_ACCESS_PER_USER) {
      throw new ConflictException(
        `Limite de ${MAX_SHARED_ACCESS_PER_USER} partages atteinte : révoquez un partage existant`,
      );
    }
    const calendarToken = randomUUID().replace(/-/g, '').slice(0, 32);
    const [row] = await this.db
      .insert(sharedAccess)
      .values({ userId, invitedEmail, calendarToken })
      .returning();
    const [user] = await this.db
      .select({ displayName: users.displayName, email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const senderName =
      user?.displayName ?? user?.email ?? 'Un utilisateur DashFlow';
    void this.mailer
      .sendCalendarInvitation(invitedEmail, senderName, calendarToken)
      .catch(() => undefined);
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db
      .delete(sharedAccess)
      .where(and(eq(sharedAccess.id, id), eq(sharedAccess.userId, userId)));
  }
}
