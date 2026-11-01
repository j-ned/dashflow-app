import { and, asc, eq, getTableColumns } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDB } from '../../db/drizzle.constants';
import {
  afterCreatedAt,
  afterId,
  CURSOR_COLUMN,
  createdAtCursorText,
  pageLimit,
  toPage,
  toPageByCreatedAt,
  type Page,
  type PageQuery,
} from './keyset';

/** Table Drizzle possédant les colonnes `id` et `userId` (et, souvent, `createdAt`). */
export type OwnedTable = PgTable & {
  id: PgColumn;
  userId: PgColumn;
  createdAt?: PgColumn;
};

export class OwnedCrudService<TRow> {
  constructor(
    protected readonly db: DrizzleDB,
    protected readonly table: OwnedTable,
  ) {}

  /**
   * Liste paginée par curseur. Ordre d'insertion `(created_at, id)` quand la table le permet —
   * c'est l'ordre que les utilisateurs voient déjà (premier compte = compte par défaut,
   * couleur des membres par index) — sinon par `id`.
   */
  async list(userId: string, q: PageQuery = {}): Promise<Page<TRow>> {
    const limit = pageLimit(q);
    const { id, userId: owner, createdAt } = this.table;
    if (createdAt) {
      const rows = await this.db
        .select({
          ...getTableColumns(this.table),
          [CURSOR_COLUMN]: createdAtCursorText(createdAt),
        })
        .from(this.table)
        .where(
          and(eq(owner, userId), afterCreatedAt(createdAt, id, q.after, 'asc')),
        )
        .orderBy(asc(createdAt), asc(id))
        .limit(limit + 1);
      return toPageByCreatedAt(
        rows as Array<TRow & { id: string; [CURSOR_COLUMN]: string }>,
        limit,
      ) as Page<TRow>;
    }
    const rows = await this.db
      .select()
      .from(this.table)
      .where(and(eq(owner, userId), afterId(id, q.after)))
      .orderBy(asc(id))
      .limit(limit + 1);
    return toPage(rows as TRow[], limit, (r) => [(r as { id: string }).id]);
  }

  async getOne(userId: string, id: string): Promise<TRow | undefined> {
    const rows = await this.db
      .select()
      .from(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)))
      .limit(1);
    return rows[0] as TRow | undefined;
  }

  async create(userId: string, values: Record<string, unknown>): Promise<TRow> {
    const rows = await this.db
      .insert(this.table)
      .values({ ...values, userId })
      .returning();
    return rows[0] as TRow;
  }

  async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<TRow | undefined> {
    const rows = await this.db
      .update(this.table)
      .set(patch)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)))
      .returning();
    return rows[0] as TRow | undefined;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.db
      .delete(this.table)
      .where(and(eq(this.table.id, id), eq(this.table.userId, userId)));
  }
}
