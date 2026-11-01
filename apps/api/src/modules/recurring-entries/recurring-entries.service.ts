import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { recurringEntries, bankAccounts, patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';
import { StorageService } from '../../storage/storage.service';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';

type RecurringEntry = typeof recurringEntries.$inferSelect;

@Injectable()
export class RecurringEntriesService extends OwnedCrudService<RecurringEntry> {
  constructor(
    @Inject(DRIZZLE) db: DrizzleDB,
    private readonly storage: StorageService,
  ) {
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
    if (typeof values.memberId === 'string') {
      await assertOwnedReference(this.db, patients, userId, values.memberId);
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

  /** Le fichier R2 part avec la ligne : plus d'objets orphelins à chaque suppression. */
  override async remove(userId: string, id: string): Promise<void> {
    const row = await this.getOne(userId, id);
    if (!row) return;
    await deleteStorageObjectQuietly(this.storage, row.payslipKey);
    await super.remove(userId, id);
  }
}
