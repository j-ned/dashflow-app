import type { db } from '@db/client';
import { patients } from '@db/schema';
import { FAMILY } from '../fixtures.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SeededFamily = {
  patients: { id: string; firstName: string; lastName: string; birthDate: string }[];
};

export async function seedFamily(tx: Tx, userId: string): Promise<SeededFamily> {
  const inserted = await tx
    .insert(patients)
    .values(
      FAMILY.map((p) => ({
        userId,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        color: p.color,
        notes: p.notes ? p.notes : null,
      })),
    )
    .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, birthDate: patients.birthDate });

  return { patients: inserted };
}
