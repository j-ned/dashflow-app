import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { accountTransactions, bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type AccountTransaction = typeof accountTransactions.$inferSelect;

type NewTransactionValues = {
  amount: string;
  direction: 'income' | 'expense' | 'transfer';
  date: string;
  toAccountId?: string | null;
  category?: string | null;
  note?: string | null;
  memberId?: string | null;
  recurringEntryId?: string | null;
  encryptedData?: string | null;
};

@Injectable()
export class AccountTransactionsService extends OwnedCrudService<AccountTransaction> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, accountTransactions);
  }

  listOfAccount(userId: string, accountId: string) {
    return this.db
      .select()
      .from(accountTransactions)
      .where(
        and(
          eq(accountTransactions.userId, userId),
          eq(accountTransactions.accountId, accountId),
        ),
      )
      .orderBy(
        desc(accountTransactions.date),
        desc(accountTransactions.createdAt),
      )
      .limit(500);
  }

  listAll(userId: string) {
    return this.db
      .select()
      .from(accountTransactions)
      .where(eq(accountTransactions.userId, userId))
      .orderBy(
        desc(accountTransactions.date),
        desc(accountTransactions.createdAt),
      )
      .limit(1000);
  }

  private static readonly UUID = z.string().uuid();

  private async ownsAccount(
    userId: string,
    accountId: string,
  ): Promise<boolean> {
    // Garde de format : un accountId non-uuid (ex. "null" issu d'une récurrence orpheline côté
    // front) ferait planter le bind drizzle → 500. On court-circuite en "non possédé" → 404 propre.
    if (!AccountTransactionsService.UUID.safeParse(accountId).success)
      return false;
    const rows = await this.db
      .select()
      .from(bankAccounts)
      .where(
        and(eq(bankAccounts.id, accountId), eq(bankAccounts.userId, userId)),
      )
      .limit(1);
    return rows.length > 0;
  }

  async addTransaction(
    userId: string,
    accountId: string,
    values: NewTransactionValues,
  ) {
    if (!(await this.ownsAccount(userId, accountId))) return undefined;
    if (
      values.toAccountId &&
      !(await this.ownsAccount(userId, values.toAccountId))
    ) {
      throw new NotFoundException('Compte destination non trouvé');
    }
    const rows = await this.db
      .insert(accountTransactions)
      .values({ ...values, userId, accountId })
      .returning();
    return rows[0];
  }

  async addBatch(
    userId: string,
    accountId: string,
    items: NewTransactionValues[],
  ) {
    if (!(await this.ownsAccount(userId, accountId))) return undefined;
    for (const item of items) {
      if (
        item.toAccountId &&
        !(await this.ownsAccount(userId, item.toAccountId))
      ) {
        throw new NotFoundException('Compte destination non trouvé');
      }
    }
    return this.db
      .insert(accountTransactions)
      .values(items.map((v) => ({ ...v, userId, accountId })))
      .returning();
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<AccountTransaction | undefined> {
    if (
      typeof patch.toAccountId === 'string' &&
      !(await this.ownsAccount(userId, patch.toAccountId))
    ) {
      throw new NotFoundException('Compte destination non trouvé');
    }
    return super.update(userId, id, patch);
  }
}
