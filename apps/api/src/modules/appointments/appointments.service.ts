import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { appointments } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Appointment = typeof appointments.$inferSelect;

@Injectable()
export class AppointmentsService extends OwnedCrudService<Appointment> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, appointments);
  }

  async setStatus(
    userId: string,
    id: string,
    status: string,
  ): Promise<Appointment | undefined> {
    return this.update(userId, id, { status });
  }
}
