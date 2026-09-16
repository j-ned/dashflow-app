import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { medications, patients, prescriptions } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';
import {
  computeMedicationStock,
  type StockProjection,
} from './medication-stock';

type Medication = typeof medications.$inferSelect;

export type MedicationWithAlert = Medication & StockProjection;

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
    if (typeof values.prescriptionId === 'string') {
      await assertOwnedReference(
        this.db,
        prescriptions,
        userId,
        values.prescriptionId,
      );
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
    if (typeof patch.prescriptionId === 'string') {
      await assertOwnedReference(
        this.db,
        prescriptions,
        userId,
        patch.prescriptionId,
      );
    }
    return super.update(userId, id, patch);
  }

  /**
   * Médicaments en alerte de rupture, selon le même modèle de stock que le front. Les lignes
   * E2EE sont exclues : leurs champs sont des placeholders, le serveur ne peut rien en dire
   * (le front calcule localement après déchiffrement).
   */
  async alerts(userId: string): Promise<MedicationWithAlert[]> {
    const rows = (await this.db
      .select()
      .from(medications)
      .where(
        and(eq(medications.userId, userId), isNull(medications.encryptedData)),
      )
      .limit(500)) as Medication[];
    return rows
      .map((med) => ({ ...med, ...computeMedicationStock(med) }))
      .filter((med) => med.isLow);
  }

  /** Incrément atomique et scopé : deux réassorts concurrents s'additionnent, pas d'écrasement. */
  async refill(
    userId: string,
    id: string,
    quantity: number,
  ): Promise<Medication | undefined> {
    const rows = await this.db
      .update(medications)
      .set({ quantity: sql`${medications.quantity} + ${quantity}` })
      .where(and(eq(medications.id, id), eq(medications.userId, userId)))
      .returning();
    return rows[0];
  }
}
