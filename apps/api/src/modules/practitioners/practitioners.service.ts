import type { DrizzleDB } from '../../db/drizzle.constants';
import { practitioners } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Practitioner = typeof practitioners.$inferSelect;

export class PractitionersService extends OwnedCrudService<Practitioner> {
  constructor(db: DrizzleDB) {
    super(db, practitioners);
  }
}
