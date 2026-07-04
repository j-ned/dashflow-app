import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { practitioners } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Practitioner = typeof practitioners.$inferSelect;

@Injectable()
export class PractitionersService extends OwnedCrudService<Practitioner> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, practitioners);
  }
}
