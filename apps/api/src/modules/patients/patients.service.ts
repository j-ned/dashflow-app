import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { patients } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';
import { StorageService } from '../../storage/storage.service';
import { purgePatientFiles } from '../../common/files/storage-cleanup';

type Patient = typeof patients.$inferSelect;

@Injectable()
export class PatientsService extends OwnedCrudService<Patient> {
  constructor(
    @Inject(DRIZZLE) db: DrizzleDB,
    private readonly storage: StorageService,
  ) {
    super(db, patients);
  }

  /** Supprimer un patient cascade ses documents et ordonnances : leurs fichiers R2 aussi. */
  override async remove(userId: string, id: string): Promise<void> {
    await purgePatientFiles(this.db, this.storage, userId, id);
    await super.remove(userId, id);
  }
}
