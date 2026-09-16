import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { salaryArchives, bankAccounts } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';
import { StorageService } from '../../storage/storage.service';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';
import {
  decodeCursor,
  pageLimit,
  toPage,
  type Page,
  type PageQuery,
} from '../../common/crud/keyset';

type SalaryArchive = typeof salaryArchives.$inferSelect;

@Injectable()
export class SalaryArchivesService extends OwnedCrudService<SalaryArchive> {
  constructor(
    @Inject(DRIZZLE) db: DrizzleDB,
    private readonly storage: StorageService,
  ) {
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

  /** Trie par mois décroissant ; curseur (month, id). */
  override async list(
    userId: string,
    q: PageQuery = {},
  ): Promise<Page<SalaryArchive>> {
    const limit = pageLimit(q);
    const c = decodeCursor(q.after, 2);
    const rows = await this.db
      .select()
      .from(salaryArchives)
      .where(
        and(
          eq(salaryArchives.userId, userId),
          c
            ? sql`(${salaryArchives.month}, ${salaryArchives.id}) < (${c[0]}, ${c[1]}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(salaryArchives.month), desc(salaryArchives.id))
      .limit(limit + 1);
    return toPage(rows, limit, (r) => [r.month, r.id]);
  }

  /** Le fichier R2 part avec la ligne : plus d'objets orphelins à chaque suppression. */
  override async remove(userId: string, id: string): Promise<void> {
    const row = await this.getOne(userId, id);
    if (!row) return;
    await deleteStorageObjectQuietly(this.storage, row.payslipKey);
    await super.remove(userId, id);
  }
}
