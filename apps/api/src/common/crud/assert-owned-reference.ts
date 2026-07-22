import { NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/drizzle.constants';
import type { OwnedTable } from './owned-crud.service';

/**
 * Vérifie qu'une ressource référencée par FK (patientId, accountId, ...) appartient bien
 * à `userId` avant de l'associer à une autre entité. Empêche un utilisateur de lier sa
 * ressource à celle d'un autre foyer via une FK non vérifiée.
 */
export async function assertOwnedReference(
  db: DrizzleDB,
  table: OwnedTable,
  userId: string,
  id: string,
): Promise<void> {
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)))
    .limit(1);
  if (rows.length === 0) {
    throw new NotFoundException('Référence invalide');
  }
}
