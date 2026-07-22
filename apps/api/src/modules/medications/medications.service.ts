import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { medications, patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';

type Medication = typeof medications.$inferSelect;

export type MedicationWithAlert = Medication & { daysRemaining: number };

@Injectable()
export class MedicationsService extends OwnedCrudService<Medication> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) {
    super(db, medications);
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Medication> {
    if (typeof values.patientId === 'string') {
      await assertOwnedReference(this.db, patients, userId, values.patientId);
    }
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Medication | undefined> {
    if (typeof patch.patientId === 'string') {
      await assertOwnedReference(this.db, patients, userId, patch.patientId);
    }
    return super.update(userId, id, patch);
  }

  async alerts(userId: string): Promise<MedicationWithAlert[]> {
    const rows = (await this.db
      .select()
      .from(medications)
      .where(eq(medications.userId, userId))
      .limit(100)) as Medication[];
    return rows
      .map((med) => {
        const dailyRate = Number(med.dailyRate);
        const skip = (med.skipDays as number[]) ?? [];
        const activeDaysPerWeek = 7 - skip.length;
        const weeklyRate = dailyRate * activeDaysPerWeek;
        const daysRemaining =
          weeklyRate > 0 ? (med.quantity / weeklyRate) * 7 : Infinity;
        return { ...med, daysRemaining: Math.round(daysRemaining * 100) / 100 };
      })
      .filter((med) => med.daysRemaining <= med.alertDaysBefore);
  }

  async refill(
    userId: string,
    id: string,
    quantity: number,
  ): Promise<Medication | undefined> {
    const rows = (await this.db
      .select({ quantity: medications.quantity })
      .from(medications)
      .where(eq(medications.id, id))
      .limit(1)) as { quantity: number }[];

    const current = rows[0];
    if (!current) return undefined;

    return this.update(userId, id, { quantity: current.quantity + quantity });
  }
}
