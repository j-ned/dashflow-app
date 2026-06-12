import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { envelopes, envelopeTransactions } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { addMoney } from '../../common/money';
import { today } from '../../common/today';

type Envelope = typeof envelopes.$inferSelect;

@Injectable()
export class EnvelopesService extends OwnedCrudService<Envelope> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, envelopes); }

  allTransactions(userId: string) {
    return this.db.select(getTableColumns(envelopeTransactions)).from(envelopeTransactions)
      .innerJoin(envelopes, and(eq(envelopeTransactions.envelopeId, envelopes.id), eq(envelopes.userId, userId)))
      .limit(1000);
  }

  async transactionsOf(userId: string, id: string) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    return this.db.select().from(envelopeTransactions)
      .where(eq(envelopeTransactions.envelopeId, id))
      .orderBy(desc(envelopeTransactions.date), desc(envelopeTransactions.createdAt)).limit(100);
  }

  async addTransaction(userId: string, id: string, values: { amount: string; date: string; note?: string | null; encryptedData?: string }) {
    const env = await this.getOne(userId, id);
    if (!env) return undefined;
    const rows = await this.db.insert(envelopeTransactions).values({ envelopeId: id, ...values }).returning();
    return rows[0];
  }

  async credit(userId: string, id: string, opts: { encryptedData?: string; amount?: number; date?: string; note?: string | null }) {
    const env = await this.getOne(userId, id) as Envelope | undefined;
    if (!env) return undefined;
    return this.db.transaction(async (tx) => {
      if (opts.encryptedData) {
        const [u] = await tx.update(envelopes).set({ encryptedData: opts.encryptedData })
          .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId))).returning();
        await tx.insert(envelopeTransactions).values({ envelopeId: id, amount: '0', date: today(), encryptedData: opts.encryptedData });
        return u;
      }
      const newBalance = String(addMoney(Number(env.balance), opts.amount ?? 0));
      const [u] = await tx.update(envelopes).set({ balance: newBalance })
        .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId))).returning();
      await tx.insert(envelopeTransactions).values({ envelopeId: id, amount: String(opts.amount ?? 0), date: opts.date || today(), note: opts.note ?? null });
      return u;
    });
  }
}
