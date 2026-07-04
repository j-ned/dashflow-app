import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { prescriptions } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Prescription = typeof prescriptions.$inferSelect;

@Injectable()
export class PrescriptionsService extends OwnedCrudService<Prescription> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, prescriptions);
  }

  byAppointment(
    userId: string,
    appointmentId: string,
  ): Promise<Prescription[]> {
    return this.db
      .select()
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.userId, userId),
          eq(prescriptions.appointmentId, appointmentId),
        ),
      )
      .limit(100);
  }
}
