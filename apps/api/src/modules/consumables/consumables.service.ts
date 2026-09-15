import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { consumables, patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type Consumable = typeof consumables.$inferSelect;

@Injectable()
export class ConsumablesService extends OwnedCrudService<Consumable> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, consumables);
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Consumable> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Consumable | undefined> {
    await this.assertOwnedFks(userId, patch);
    return super.update(userId, id, patch);
  }

  private async assertOwnedFks(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (typeof values.memberId === 'string') {
      await assertOwnedReference(this.db, patients, userId, values.memberId);
    }
  }
}
