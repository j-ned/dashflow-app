import { Inject, Injectable } from '@nestjs/common';
import { count, eq, ilike, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users, subscriptions } from '../../db/schema';

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: Date;
  planKey: string | null;
  status: string | null;
  source: string | null;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
};

@Injectable()
export class AdminRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listUsersWithSubscription(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<AdminUserRow[]> {
    const where = opts.search ? ilike(users.email, `%${opts.search}%`) : undefined;
    return this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        isDemoAccount: users.isDemoAccount,
        createdAt: users.createdAt,
        planKey: subscriptions.planKey,
        status: subscriptions.status,
        source: subscriptions.source,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        stripeCustomerId: subscriptions.stripeCustomerId,
      })
      .from(users)
      .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
      .where(where)
      .orderBy(sql`${users.createdAt} desc`)
      .limit(opts.limit)
      .offset(opts.offset) as Promise<AdminUserRow[]>;
  }

  async countAll(search?: string): Promise<number> {
    const where = search ? ilike(users.email, `%${search}%`) : undefined;
    const rows = await this.db.select({ value: count() }).from(users).where(where);
    return Number(rows[0]?.value ?? 0);
  }
}
