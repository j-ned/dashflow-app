import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Patient = typeof patients.$inferSelect;

@Injectable()
export class PatientsService extends OwnedCrudService<Patient> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, patients);
  }
}
