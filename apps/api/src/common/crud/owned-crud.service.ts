import { and, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/drizzle.constants';

/** Table Drizzle possédant les colonnes `id` et `userId`. */
export class OwnedCrudService<TRow> {
  constructor(
    protected readonly db: DrizzleDB,
    protected readonly table: any,
  ) {}

  list(userId: string): Promise<TRow[]> {
    return this.db.select().from(this.table).where(eq(this.table.userId, userId)).limit(100) as Promise<TRow[]>;
  }

  async getOne(userId: string, id: string): Promise<TRow | undefined> {
    const rows = await this.db.select().from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId))).limit(1);
    return rows[0] as TRow | undefined;
  }

  async create(userId: string, values: Record<string, unknown>): Promise<TRow> {
    const rows = await this.db.insert(this.table).values({ ...values, userId }).returning();
    return rows[0] as TRow;
  }

  async update(userId: string, id: string, patch: Record<string, unknown>): Promise<TRow | undefined> {
    const rows = await this.db.update(this.table).set(patch)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId))).returning();
    return rows[0] as TRow | undefined;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db.delete(this.table).where(and(eq(this.table.id, id), eq(this.table.userId, userId)));
  }
}
