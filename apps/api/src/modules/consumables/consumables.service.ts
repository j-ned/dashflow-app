import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { consumables } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Consumable = typeof consumables.$inferSelect;

@Injectable()
export class ConsumablesService extends OwnedCrudService<Consumable> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, consumables); }
}
