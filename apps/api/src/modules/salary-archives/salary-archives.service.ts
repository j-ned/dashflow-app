import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { salaryArchives, bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type SalaryArchive = typeof salaryArchives.$inferSelect;

@Injectable()
export class SalaryArchivesService extends OwnedCrudService<SalaryArchive> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, salaryArchives);
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<SalaryArchive> {
    if (typeof values.accountId === 'string') {
      await assertOwnedReference(
        this.db,
        bankAccounts,
        userId,
        values.accountId,
      );
    }
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<SalaryArchive | undefined> {
    if (typeof patch.accountId === 'string') {
      await assertOwnedReference(
        this.db,
        bankAccounts,
        userId,
        patch.accountId,
      );
    }
    return super.update(userId, id, patch);
  }

  /** Trie par mois décroissant. */
  override list(userId: string): Promise<SalaryArchive[]> {
    return this.db
      .select()
      .from(salaryArchives)
      .where(eq(salaryArchives.userId, userId))
      .orderBy(desc(salaryArchives.month))
      .limit(200);
  }
}
