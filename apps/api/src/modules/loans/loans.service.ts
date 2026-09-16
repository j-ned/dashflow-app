import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { loans, loanTransactions, patients } from '../../db/schema';
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
import { addMoney, toCents } from '../../common/money';
import { today } from '../../common/today';
import type { Loan } from './loan.response';

type LoanTransaction = typeof loanTransactions.$inferSelect;

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

  allTransactions(
    userId: string,
    q: PageQuery = {},
  ): Promise<Page<LoanTransaction>> {
    const t = loanTransactions;
    const limit = pageLimit(q);
    return this.db
      .select({
        ...getTableColumns(t),
        [CURSOR_COLUMN]: createdAtCursorText(t.createdAt),
      })
      .from(t)
      .innerJoin(loans, and(eq(t.loanId, loans.id), eq(loans.userId, userId)))
      .where(afterCreatedAt(t.createdAt, t.id, q.after, 'desc'))
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(limit + 1)
      .then((rows) => toPageByCreatedAt(rows, limit));
  }

  async transactionsOf(
    userId: string,
    id: string,
    q: PageQuery = {},
  ): Promise<Page<LoanTransaction> | undefined> {
    const loan = await this.getOne(userId, id);
    if (!loan) return undefined;
    const t = loanTransactions;
    const limit = pageLimit(q);
    const rows = await this.db
      .select({
        ...getTableColumns(t),
        [CURSOR_COLUMN]: createdAtCursorText(t.createdAt),
      })
      .from(t)
      .where(
        and(
          eq(t.loanId, id),
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
      encryptedData?: string;
    },
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
