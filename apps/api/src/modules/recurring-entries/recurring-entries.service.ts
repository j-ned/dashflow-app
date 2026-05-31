import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { recurringEntries } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type RecurringEntry = typeof recurringEntries.$inferSelect;

@Injectable()
export class RecurringEntriesService extends OwnedCrudService<RecurringEntry> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, recurringEntries);
  }
}
