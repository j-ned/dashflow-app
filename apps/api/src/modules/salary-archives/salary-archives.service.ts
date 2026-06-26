import { Inject, Injectable } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { salaryArchives } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type SalaryArchive = typeof salaryArchives.$inferSelect;

@Injectable()
export class SalaryArchivesService extends OwnedCrudService<SalaryArchive> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, salaryArchives);
  }

  /** Trie par mois décroissant. */
  override list(userId: string): Promise<SalaryArchive[]> {
    return this.db
      .select()
      .from(salaryArchives)
      .where(eq(salaryArchives.userId, userId))
      .orderBy(desc(salaryArchives.month))
      .limit(200) as Promise<SalaryArchive[]>;
  }
}
