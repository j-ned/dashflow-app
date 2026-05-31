import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { patients } from '../../db/schema';

@Injectable()
export class MembersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  list(userId: string) {
    return this.db.select({
      id: patients.id, firstName: patients.firstName, lastName: patients.lastName,
      color: patients.color, encryptedData: patients.encryptedData,
    }).from(patients).where(eq(patients.userId, userId)).limit(100);
  }

  async updateColor(userId: string, id: string, color: string | null) {
    const rows = await this.db.update(patients).set({ color })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, color: patients.color });
    return rows[0];
  }
}
