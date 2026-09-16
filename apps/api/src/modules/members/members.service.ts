import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import {
  appointments,
  documents,
  medications,
  patients,
  prescriptions,
} from '../../db/schema';
import {
  afterCreatedAt,
  CURSOR_COLUMN,
  createdAtCursorText,
  pageLimit,
  toPageByCreatedAt,
  type Page,
  type PageQuery,
} from '../../common/crud/keyset';

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

export type MemberRow = {
  id: string;
  firstName: string;
  lastName: string;
  color: string | null;
  encryptedData: string | null;
};

/** Ce qui disparaîtrait avec le membre : la table `patients` porte aussi le dossier médical. */
export type MedicalFootprint = {
  appointments: number;
  prescriptions: number;
  medications: number;
  documents: number;
};

// Sous-requête corrélée. Colonnes qualifiées à la main : dans un select mono-table, drizzle
// rend `${appointments.patientId}` en "patient_id" nu, et `${patients.id}` en "id" — qui serait
// alors résolu sur la table interne (appointments.id) → toujours 0.
const count = (table: PgTable & { patientId: PgColumn }) =>
  sql<number>`(select count(*) from ${table} where ${table}.${sql.identifier(table.patientId.name)} = ${patients}.${sql.identifier(patients.id.name)})`.mapWith(
    Number,
  );

@Injectable()
export class MembersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(userId: string, q: PageQuery = {}): Promise<Page<MemberRow>> {
    const limit = pageLimit(q);
    const rows = await this.db
      .select({
        ...MEMBER_PROJECTION,
        [CURSOR_COLUMN]: createdAtCursorText(patients.createdAt),
      })
      .from(patients)
      .where(
        and(
          eq(patients.userId, userId),
          afterCreatedAt(patients.createdAt, patients.id, q.after, 'asc'),
        ),
      )
      .orderBy(asc(patients.createdAt), asc(patients.id))
      .limit(limit + 1);
    return toPageByCreatedAt(rows, limit);
  }

  async create(userId: string, values: Record<string, unknown>) {
    const rows = await this.db
      .insert(patients)
      .values({
        firstName: '',
        lastName: '',
        birthDate: null,
        ...values,
        userId,
      })
      .returning(MEMBER_PROJECTION);
    return rows[0];
  }

  async update(userId: string, id: string, patch: Record<string, unknown>) {
    const rows = await this.db
      .update(patients)
      .set(patch)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning(MEMBER_PROJECTION);
    return rows[0];
  }

  /** `undefined` si le membre n'existe pas (ou n'appartient pas à l'utilisateur). */
  async medicalFootprint(
    userId: string,
    id: string,
  ): Promise<MedicalFootprint | undefined> {
    const rows = await this.db
      .select({
        appointments: count(appointments),
        prescriptions: count(prescriptions),
        medications: count(medications),
        documents: count(documents),
      })
      .from(patients)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .limit(1);
    return rows[0];
  }

  async remove(userId: string, id: string) {
    await this.db
      .delete(patients)
      .where(and(eq(patients.id, id), eq(patients.userId, userId)));
  }

  async updateColor(userId: string, id: string, color: string | null) {
    const rows = await this.db
      .update(patients)
      .set({ color })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning(MEMBER_PROJECTION);
    return rows[0];
  }
}
