import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { prescriptions, patients, practitioners } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type Prescription = typeof prescriptions.$inferSelect;

@Injectable()
export class PrescriptionsService extends OwnedCrudService<Prescription> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, prescriptions);
  }

  private async assertOwnedFks(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<void> {
    if (typeof values.patientId === 'string') {
      await assertOwnedReference(this.db, patients, userId, values.patientId);
    }
    if (typeof values.practitionerId === 'string') {
      await assertOwnedReference(
        this.db,
        practitioners,
        userId,
        values.practitionerId,
      );
    }
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Prescription> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Prescription | undefined> {
    await this.assertOwnedFks(userId, patch);
    return super.update(userId, id, patch);
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
