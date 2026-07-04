import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { reminders } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Reminder = typeof reminders.$inferSelect;

@Injectable()
export class RemindersService extends OwnedCrudService<Reminder> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, reminders);
  }

  async toggle(userId: string, id: string): Promise<Reminder | undefined> {
    const current = await this.getOne(userId, id);
    if (!current) return undefined;
    return this.update(userId, id, { enabled: !current.enabled });
  }
}
