import { Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { DrizzleDB } from '../../db/drizzle.constants';
import { documents, prescriptions } from '../../db/schema';
import type { StorageService } from '../../storage/storage.service';

const logger = new Logger('StorageCleanup');

/**
 * Supprime un objet R2 en tolérant l'échec : un objet orphelin coûte quelques Ko, une
 * suppression métier bloquée par le stockage coûte un utilisateur. L'échec est journalisé.
 */
export async function deleteStorageObjectQuietly(
  storage: StorageService,
  key: string | null | undefined,
): Promise<void> {
  if (!key) return;
  try {
    await storage.delete(key);
  } catch (err) {
    logger.warn(
      `Objet R2 non supprimé (${key}) : ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/** Fichiers portés par les documents et ordonnances d'un patient : à purger avant la cascade SQL. */
export async function purgePatientFiles(
  db: DrizzleDB,
  storage: StorageService,
  userId: string,
  patientId: string,
): Promise<void> {
  const [docs, prescs] = await Promise.all([
    db
      .select({ key: documents.fileUrl })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), eq(documents.patientId, patientId)),
      ),
    db
      .select({ key: prescriptions.documentUrl })
      .from(prescriptions)
      .where(
        and(
          eq(prescriptions.userId, userId),
          eq(prescriptions.patientId, patientId),
        ),
      ),
  ]);
  for (const { key } of [...docs, ...prescs]) {
    await deleteStorageObjectQuietly(storage, key);
  }
}
