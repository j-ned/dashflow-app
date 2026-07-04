import { Inject, Injectable } from '@nestjs/common';
import { count, ilike, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users } from '../../db/schema';

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: Date;
};

@Injectable()
export class AdminRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listUsers(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<AdminUserRow[]> {
    const where = opts.search
      ? ilike(users.email, `%${opts.search}%`)
      : undefined;
    return this.db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        isDemoAccount: users.isDemoAccount,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(sql`${users.createdAt} desc`)
      .limit(opts.limit)
      .offset(opts.offset);
  }

  async countAll(search?: string): Promise<number> {
    const where = search ? ilike(users.email, `%${search}%`) : undefined;
    const rows = await this.db
      .select({ value: count() })
      .from(users)
      .where(where);
    return Number(rows[0]?.value ?? 0);
  }
}
