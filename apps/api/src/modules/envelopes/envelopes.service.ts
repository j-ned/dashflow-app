import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { envelopes, envelopeTransactions, patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';
import {
  afterCreatedAt,
  CURSOR_COLUMN,
  createdAtCursorText,
  pageLimit,
  toPageByCreatedAt,
  type Page,
  type PageQuery,
} from '../../common/crud/keyset';
import { addMoney } from '../../common/money';
import { today } from '../../common/today';
import type { Envelope } from './envelope.response';

type EnvelopeTransaction = typeof envelopeTransactions.$inferSelect;

@Injectable()
export class EnvelopesService extends OwnedCrudService<Envelope> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, envelopes);
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Envelope> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Envelope | undefined> {
    await this.assertOwnedFks(userId, patch);
    return super.update(userId, id, patch);
  }

  private async assertOwnedFks(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (typeof values.memberId === 'string') {
      await assertOwnedReference(this.db, patients, userId, values.memberId);
    }
  }

  allTransactions(
    userId: string,
    q: PageQuery = {},
  ): Promise<Page<EnvelopeTransaction>> {
    const t = envelopeTransactions;
    const limit = pageLimit(q);
    return this.db
      .select({
        ...getTableColumns(t),
        [CURSOR_COLUMN]: createdAtCursorText(t.createdAt),
      })
      .from(t)
      .innerJoin(
        envelopes,
        and(eq(t.envelopeId, envelopes.id), eq(envelopes.userId, userId)),
      )
      .where(afterCreatedAt(t.createdAt, t.id, q.after, 'desc'))
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(limit + 1)
      .then((rows) => toPageByCreatedAt(rows, limit));
  }

  async transactionsOf(
    userId: string,
    id: string,
    q: PageQuery = {},
  ): Promise<Page<EnvelopeTransaction> | undefined> {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    const t = envelopeTransactions;
    const limit = pageLimit(q);
    const rows = await this.db
      .select({
        ...getTableColumns(t),
        [CURSOR_COLUMN]: createdAtCursorText(t.createdAt),
      })
      .from(t)
      .where(
        and(
          eq(t.envelopeId, id),
          afterCreatedAt(t.createdAt, t.id, q.after, 'desc'),
        ),
      )
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(limit + 1);
    return toPageByCreatedAt(rows, limit);
  }

  async addTransaction(
    userId: string,
    id: string,
    values: {
      id?: string;
      amount: string;
      date: string;
      note?: string | null;
      encryptedData?: string;
    },
  ) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    const rows = await this.db
      .insert(envelopeTransactions)
      .values({ envelopeId: id, ...values })
      .returning();
    return rows[0];
  }

  async credit(
    userId: string,
    id: string,
    opts: {
      encryptedData?: string;
      amount?: number;
      date?: string;
      note?: string | null;
    },
  ) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    return this.db.transaction(async (tx) => {
      if (opts.encryptedData) {
        const [u] = await tx
          .update(envelopes)
          .set({ encryptedData: opts.encryptedData })
          .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
          .returning();
        await tx.insert(envelopeTransactions).values({
          envelopeId: id,
          amount: '0',
          date: today(),
          encryptedData: opts.encryptedData,
        });
        return u;
      }
      // Lecture verrouillée : deux crédits concurrents (double-clic, deux onglets) se sérialisent
      // au lieu de s'écraser (lost update). `env` lu hors transaction ne sert qu'à l'ownership.
      const [locked] = await tx
        .select({ balance: envelopes.balance })
        .from(envelopes)
        .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
        .for('update');
      const newBalance = String(
        addMoney(Number(locked?.balance ?? env.balance), opts.amount ?? 0),
      );
      const [u] = await tx
        .update(envelopes)
        .set({ balance: newBalance })
        .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
        .returning();
      await tx.insert(envelopeTransactions).values({
        envelopeId: id,
        amount: String(opts.amount ?? 0),
        date: opts.date || today(),
        note: opts.note ?? null,
      });
      return u;
    });
  }
}
