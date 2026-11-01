import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { appointments, patients, practitioners } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type Appointment = typeof appointments.$inferSelect;

@Injectable()
export class AppointmentsService extends OwnedCrudService<Appointment> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, appointments);
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
  ): Promise<Appointment> {
    await this.assertOwnedFks(userId, values);
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Appointment | undefined> {
    await this.assertOwnedFks(userId, patch);
    return super.update(userId, id, patch);
  }

  async setStatus(
    userId: string,
    id: string,
    status: string,
  ): Promise<Appointment | undefined> {
    return this.update(userId, id, { status });
  }
}
