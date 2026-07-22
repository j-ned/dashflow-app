import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { reminders, medications, appointments } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type Reminder = typeof reminders.$inferSelect;

@Injectable()
export class RemindersService extends OwnedCrudService<Reminder> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, reminders);
  }

  private async assertOwnedFks(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (typeof values.medicationId === 'string') {
      await assertOwnedReference(
        this.db,
        medications,
        userId,
        values.medicationId,
      );
    }
    if (typeof values.appointmentId === 'string') {
      await assertOwnedReference(
        this.db,
        appointments,
        userId,
        values.appointmentId,
      );
    }
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Reminder> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Reminder | undefined> {
    await this.assertOwnedFks(userId, patch);
    return super.update(userId, id, patch);
  }

  async toggle(userId: string, id: string): Promise<Reminder | undefined> {
    const current = await this.getOne(userId, id);
    if (!current) return undefined;
    return this.update(userId, id, { enabled: !current.enabled });
  }
}
