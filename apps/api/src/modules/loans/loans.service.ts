import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { loans, loanTransactions } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { addMoney } from '../../common/money';

type Loan = typeof loans.$inferSelect;
const today = (): string => new Date().toISOString().slice(0, 10);

@Injectable()
export class LoansService extends OwnedCrudService<Loan> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, loans); }

  allTransactions(userId: string) {
    return this.db.select(getTableColumns(loanTransactions)).from(loanTransactions)
      .innerJoin(loans, and(eq(loanTransactions.loanId, loans.id), eq(loans.userId, userId)))
      .limit(1000);
  }

  async transactionsOf(userId: string, id: string) {
    const loan = await this.getOne(userId, id);
    if (!loan) return undefined;
    return this.db.select().from(loanTransactions)
      .where(eq(loanTransactions.loanId, id))
      .orderBy(desc(loanTransactions.date), desc(loanTransactions.createdAt)).limit(100);
  }

  async addTransaction(userId: string, id: string, values: { amount: string; date: string; encryptedData?: string }) {
    const loan = await this.getOne(userId, id);
    if (!loan) return undefined;
    const rows = await this.db.insert(loanTransactions).values({ loanId: id, ...values }).returning();
    return rows[0];
  }

  async recordPayment(userId: string, id: string, opts: { amount: number; date?: string }) {
    const current = await this.getOne(userId, id) as Loan | undefined;
    if (!current) return undefined;
    const txDate = opts.date || today();
    const newRemaining = String(Math.max(0, addMoney(Number(current.remaining), -opts.amount)));
    return this.db.transaction(async (tx) => {
      const [updated] = await tx.update(loans).set({ remaining: newRemaining })
        .where(and(eq(loans.id, id), eq(loans.userId, userId))).returning();
      await tx.insert(loanTransactions).values({ loanId: id, amount: String(opts.amount), date: txDate });
      return updated;
    });
  }
}
