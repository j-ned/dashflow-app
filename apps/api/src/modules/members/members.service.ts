import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { patients } from '../../db/schema';

// Les membres du foyer (core) sont stockés dans la table `patients` ; le module medical
// (Premium) ajoute les données médicales sur ces mêmes personnes. `birthDate` est nullable :
// un membre créé côté budget n'en a pas. Projection réduite (pas de champs médicaux).
const MEMBER_PROJECTION = {
  id: patients.id,
  firstName: patients.firstName,
  lastName: patients.lastName,
  color: patients.color,
  encryptedData: patients.encryptedData,
};

@Injectable()
export class MembersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  list(userId: string) {
    return this.db.select(MEMBER_PROJECTION).from(patients)
      .where(eq(patients.userId, userId)).limit(100);
  }

  async create(userId: string, values: Record<string, unknown>) {
    const rows = await this.db.insert(patients)
      .values({ firstName: '', lastName: '', birthDate: null, ...values, userId })
      .returning(MEMBER_PROJECTION);
    return rows[0];
  }

  async update(userId: string, id: string, patch: Record<string, unknown>) {
    const rows = await this.db.update(patients).set(patch)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning(MEMBER_PROJECTION);
    return rows[0];
  }

  async remove(userId: string, id: string) {
    await this.db.delete(patients).where(and(eq(patients.id, id), eq(patients.userId, userId)));
  }

  async updateColor(userId: string, id: string, color: string | null) {
    const rows = await this.db.update(patients).set({ color })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning(MEMBER_PROJECTION);
    return rows[0];
  }
}
