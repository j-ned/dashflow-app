import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { recurringEntries, bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type RecurringEntry = typeof recurringEntries.$inferSelect;

@Injectable()
export class RecurringEntriesService extends OwnedCrudService<RecurringEntry> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, recurringEntries);
  }

  private async assertOwnedFks(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (typeof values.accountId === 'string') {
      await assertOwnedReference(
        this.db,
        bankAccounts,
        userId,
        values.accountId,
      );
    }
    if (typeof values.toAccountId === 'string') {
      await assertOwnedReference(
        this.db,
        bankAccounts,
        userId,
        values.toAccountId,
      );
    }
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<RecurringEntry> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<RecurringEntry | undefined> {
    await this.assertOwnedFks(userId, patch);
    return super.update(userId, id, patch);
  }
}
