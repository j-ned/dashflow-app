import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { documents } from '../../db/schema';
import { OwnedCrudService } from '../../common/crud/owned-crud.service';

type Document = typeof documents.$inferSelect;

@Injectable()
export class DocumentsService extends OwnedCrudService<Document> {
  constructor(@Inject(DRIZZLE) db: DrizzleDB) { super(db, documents); }

  byPatient(userId: string, patientId: string): Promise<Document[]> {
    return this.db.select().from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.patientId, patientId)))
      .limit(100) as Promise<Document[]>;
  }
}
