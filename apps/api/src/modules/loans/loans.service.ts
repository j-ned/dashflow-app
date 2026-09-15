import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { loans, loanTransactions, patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';
import { addMoney, toCents } from '../../common/money';
import { today } from '../../common/today';
import type { Loan } from './loan.response';

@Injectable()
export class LoansService extends OwnedCrudService<Loan> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, loans);
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Loan> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Loan | undefined> {
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

  allTransactions(userId: string) {
    return this.db
      .select(getTableColumns(loanTransactions))
      .from(loanTransactions)
      .innerJoin(
        loans,
        and(eq(loanTransactions.loanId, loans.id), eq(loans.userId, userId)),
      )
      .limit(1000);
  }

  async transactionsOf(userId: string, id: string) {
    const loan = await this.getOne(userId, id);
    if (!loan) return undefined;
    return this.db
      .select()
      .from(loanTransactions)
      .where(eq(loanTransactions.loanId, id))
      .orderBy(desc(loanTransactions.date), desc(loanTransactions.createdAt))
      .limit(100);
  }

  async addTransaction(
    userId: string,
    id: string,
    values: { amount: string; date: string; encryptedData?: string },
  ) {
    const loan = await this.getOne(userId, id);
    if (!loan) return undefined;
    const rows = await this.db
      .insert(loanTransactions)
      .values({ loanId: id, ...values })
      .returning();
    return rows[0];
  }

  async recordPayment(
    userId: string,
    id: string,
    opts: { amount: number; date?: string; note?: string | null },
  ) {
    const current = await this.getOne(userId, id);
    if (!current) return undefined;
    const txDate = opts.date || today();
    return this.db.transaction(async (tx) => {
      // Lecture verrouillée : deux paiements concurrents (double-clic, deux onglets) se
      // sérialisent au lieu de s'écraser. `current` lu hors transaction ne sert qu'à l'ownership.
      const [locked] = await tx
        .select({ remaining: loans.remaining })
        .from(loans)
        .where(and(eq(loans.id, id), eq(loans.userId, userId)))
        .for('update');
      const remaining = Number(locked?.remaining ?? current.remaining);
      // Un paiement supérieur au restant dû casserait l'invariant Σ paiements = amount − remaining
      // (avant : remaining clampé à 0 mais le mouvement enregistré en entier).
      if (toCents(opts.amount) > toCents(remaining)) {
        throw new BadRequestException(
          `Le paiement dépasse le restant dû (${remaining.toFixed(2)})`,
        );
      }
      const newRemaining = String(addMoney(remaining, -opts.amount));
      const [updated] = await tx
        .update(loans)
        .set({ remaining: newRemaining })
        .where(and(eq(loans.id, id), eq(loans.userId, userId)))
        .returning();
      await tx.insert(loanTransactions).values({
        loanId: id,
        amount: String(opts.amount),
        date: txDate,
        note: opts.note ?? null,
      });
      return updated;
    });
  }
}
