import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { medications } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Medication = typeof medications.$inferSelect;

export type MedicationWithAlert = Medication & { daysRemaining: number };

@Injectable()
export class MedicationsService extends OwnedCrudService<Medication> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, medications); }

  /**
   * Faithful port of Hono GET /alerts:
   * 1. Fetch all user medications (limit 100).
   * 2. For each med, compute daysRemaining = (quantity / weeklyRate) * 7
   *    where weeklyRate = dailyRate * (7 - skipDays.length).
   *    If weeklyRate === 0, daysRemaining = Infinity.
   * 3. Round to 2 decimal places.
   * 4. Filter: keep only meds where daysRemaining <= alertDaysBefore.
   */
  async alerts(userId: string): Promise<MedicationWithAlert[]> {
    const rows = await this.db.select().from(this.table).where(eq(this.table.userId, userId)).limit(100) as Medication[];
    return rows
      .map((med) => {
        const dailyRate = Number(med.dailyRate);
        const skip = (med.skipDays as number[]) ?? [];
        const activeDaysPerWeek = 7 - skip.length;
        const weeklyRate = dailyRate * activeDaysPerWeek;
        const daysRemaining = weeklyRate > 0 ? (med.quantity / weeklyRate) * 7 : Infinity;
        return { ...med, daysRemaining: Math.round(daysRemaining * 100) / 100 };
      })
      .filter((med) => med.daysRemaining <= med.alertDaysBefore);
  }

  /**
   * Faithful port of Hono PATCH /:id/refill:
   * 1. Fetch current quantity for the medication.
   * 2. If not found, return undefined (controller throws 404).
   * 3. Update quantity to current.quantity + refill quantity.
   */
  async refill(userId: string, id: string, quantity: number): Promise<Medication | undefined> {
    const rows = await this.db
      .select({ quantity: this.table.quantity })
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1) as { quantity: number }[];

    const current = rows[0];
    if (!current) return undefined;

    return this.update(userId, id, { quantity: current.quantity + quantity });
  }
}
