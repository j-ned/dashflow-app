import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { and, desc, eq, getTableColumns, type SQL } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import {
  accountTransactions,
  bankAccounts,
  patients,
  recurringEntries,
} from '../../db/schema';
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

  /**
   * Pages « plus récent d'abord » sur (created_at, id) : en E2EE `date` est un placeholder,
   * seul l'ordre d'insertion est fiable. Le front suit `X-Next-Cursor` jusqu'au bout avant de
   * sommer — plus de solde faux en silence au-delà de 1000 lignes.
   */
  listOfAccount(
    userId: string,
    accountId: string,
    q: PageQuery = {},
  ): Promise<Page<AccountTransaction>> {
    return this.page(
      and(
        eq(accountTransactions.userId, userId),
        eq(accountTransactions.accountId, accountId),
      ),
      q,
    );
  }

  listAll(
    userId: string,
    q: PageQuery = {},
  ): Promise<Page<AccountTransaction>> {
    return this.page(eq(accountTransactions.userId, userId), q);
  }

  private async page(
    scope: SQL | undefined,
    q: PageQuery,
  ): Promise<Page<AccountTransaction>> {
    const limit = pageLimit(q);
    const t = accountTransactions;
    const rows = await this.db
      .select({
        ...getTableColumns(t),
        [CURSOR_COLUMN]: createdAtCursorText(t.createdAt),
      })
      .from(t)
      .where(and(scope, afterCreatedAt(t.createdAt, t.id, q.after, 'desc')))
      .orderBy(desc(t.createdAt), desc(t.id))
      .limit(limit + 1);
    return toPageByCreatedAt(rows, limit);
  }

  // Un virement vers le compte d'origine est un non-sens comptable (doublé par un CHECK en base).
  private static assertNotSelfTransfer(
    accountId: string,
    toAccountId: string | null | undefined,
  ): void {
    if (toAccountId && toAccountId === accountId) {
      throw new BadRequestException(
        "Un virement ne peut pas cibler le compte d'origine",
      );
    }
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

  // memberId / recurringEntryId sont des FK optionnelles vers des tables scopées user_id :
  // sans ce contrôle, on lie sa transaction au membre ou à la récurrence d'un autre foyer.
  private async assertOwnedOptionalFks(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (typeof values.memberId === 'string') {
      await assertOwnedReference(this.db, patients, userId, values.memberId);
    }
    if (typeof values.recurringEntryId === 'string') {
      await assertOwnedReference(
        this.db,
        recurringEntries,
        userId,
        values.recurringEntryId,
      );
    }
  }

  async addTransaction(
    userId: string,
    accountId: string,
    values: NewTransactionValues,
  ) {
    if (!(await this.ownsAccount(userId, accountId))) return undefined;
    AccountTransactionsService.assertNotSelfTransfer(
      accountId,
      values.toAccountId,
    );
    await this.assertOwnedOptionalFks(userId, values);
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
      AccountTransactionsService.assertNotSelfTransfer(
        accountId,
        item.toAccountId,
      );
      await this.assertOwnedOptionalFks(userId, item);
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
    if (typeof patch.toAccountId === 'string') {
      if (!(await this.ownsAccount(userId, patch.toAccountId))) {
        throw new NotFoundException('Compte destination non trouvé');
      }
      const current = await this.getOne(userId, id);
      if (!current) return undefined;
      AccountTransactionsService.assertNotSelfTransfer(
        current.accountId,
        patch.toAccountId,
      );
    }
    await this.assertOwnedOptionalFks(userId, patch);
    return super.update(userId, id, patch);
  }
}
