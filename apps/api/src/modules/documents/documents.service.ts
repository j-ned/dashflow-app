import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { documents, patients, practitioners } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { assertOwnedReference } from '../../common/crud/assert-owned-reference';
import { StorageService } from '../../storage/storage.service';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';

type Document = typeof documents.$inferSelect;

@Injectable()
export class DocumentsService extends OwnedCrudService<Document> {
  constructor(
    @Inject(DRIZZLE) db: DrizzleDB,
    private readonly storage: StorageService,
  ) {
    super(db, documents);
  }

  override async create(
    userId: string,
    values: Record<string, unknown>,
  ): Promise<Document> {
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
    return super.create(userId, values);
  }

  override async update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<Document | undefined> {
    if (typeof patch.patientId === 'string') {
      await assertOwnedReference(this.db, patients, userId, patch.patientId);
    }
    if (typeof patch.practitionerId === 'string') {
      await assertOwnedReference(
        this.db,
        practitioners,
        userId,
        patch.practitionerId,
      );
    }
    return super.update(userId, id, patch);
  }

  byPatient(userId: string, patientId: string): Promise<Document[]> {
    return this.db
      .select()
      .from(documents)
      .where(
        and(eq(documents.userId, userId), eq(documents.patientId, patientId)),
      )
      .limit(100);
  }

  /** Le fichier R2 part avec la ligne : plus d'objets orphelins à chaque suppression. */
  override async remove(userId: string, id: string): Promise<void> {
    const row = await this.getOne(userId, id);
    if (!row) return;
    await deleteStorageObjectQuietly(this.storage, row.fileUrl);
    await super.remove(userId, id);
  }
}
