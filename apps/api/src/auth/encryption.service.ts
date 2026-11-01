import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq, inArray } from 'drizzle-orm';
import { AuthRepository } from './auth.repository';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';
import { ok, fail, type Result } from './auth.result';
import type {
  SetupEncryptionKeysDto,
  MigrateEncryptionDto,
  ResetWithRecoveryDto,
} from './dto/auth.dto';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema';

type OwnedTable = PgTable & { id: PgColumn; userId: PgColumn };
type ChildTable = PgTable & { id: PgColumn };

/**
 * Comment scoper une table pendant la migration :
 * - `own`   : la table porte `user_id`, on filtre dessus ;
 * - `child` : la table n'a pas `user_id` (mouvements d'enveloppe / de prêt), on la scope via
 *             son parent (`fk IN (SELECT id FROM parent WHERE user_id = $u)`). Sans cela un
 *             utilisateur pouvait écraser `encrypted_data` d'un mouvement d'un autre foyer en
 *             connaissant son UUID.
 */
type MigrateMapping =
  | { kind: 'own'; table: OwnedTable }
  | { kind: 'child'; table: ChildTable; fk: PgColumn; parent: OwnedTable };

/** Toutes les tables porteuses de `encrypted_data`. Tenue en miroir côté front (encryption-setup). */
export const MIGRATE_TABLES: Record<string, MigrateMapping> = {
  bankAccounts: { kind: 'own', table: schema.bankAccounts },
  accountTransactions: { kind: 'own', table: schema.accountTransactions },
  envelopes: { kind: 'own', table: schema.envelopes },
  envelopeTransactions: {
    kind: 'child',
    table: schema.envelopeTransactions,
    fk: schema.envelopeTransactions.envelopeId,
    parent: schema.envelopes,
  },
  loans: { kind: 'own', table: schema.loans },
  loanTransactions: {
    kind: 'child',
    table: schema.loanTransactions,
    fk: schema.loanTransactions.loanId,
    parent: schema.loans,
  },
  recurringEntries: { kind: 'own', table: schema.recurringEntries },
  salaryArchives: { kind: 'own', table: schema.salaryArchives },
  patients: { kind: 'own', table: schema.patients },
  practitioners: { kind: 'own', table: schema.practitioners },
  appointments: { kind: 'own', table: schema.appointments },
  prescriptions: { kind: 'own', table: schema.prescriptions },
  medications: { kind: 'own', table: schema.medications },
  documents: { kind: 'own', table: schema.documents },
};

/** Valeurs neutres écrites dans les colonnes en clair une fois le contenu déplacé dans le blob. */
export const CLEAR_COLUMNS: Record<string, Record<string, unknown>> = {
  bankAccounts: {
    name: '[chiffré]',
    type: 'courant',
    color: null,
    dotColor: null,
  },
  accountTransactions: {
    amount: '0',
    date: '1970-01-01',
    category: null,
    note: null,
  },
  envelopes: {
    name: '[chiffré]',
    type: 'épargne',
    balance: '0',
    target: null,
    color: null,
    dueDay: null,
  },
  envelopeTransactions: { amount: '0', date: '1970-01-01' },
  loans: {
    person: '[chiffré]',
    direction: 'lent',
    amount: '0',
    remaining: '0',
    description: null,
    date: '1970-01-01',
    dueDate: null,
    dueDay: null,
  },
  loanTransactions: { amount: '0', date: '1970-01-01' },
  recurringEntries: {
    label: '[chiffré]',
    amount: '0',
    type: 'expense',
    dayOfMonth: null,
    date: null,
    category: null,
    payslipKey: null,
  },
  salaryArchives: {
    month: '0000-00',
    salary: '0',
    totalExpenses: '0',
    totalSpendings: '0',
    spendings: [],
    payslipKey: null,
  },
  patients: {
    firstName: '[chiffré]',
    lastName: '[chiffré]',
    birthDate: '1970-01-01',
    color: null,
    notes: null,
  },
  practitioners: {
    name: '[chiffré]',
    type: 'autre',
    phone: null,
    email: null,
    address: null,
    bookingUrl: null,
  },
  appointments: {
    date: '1970-01-01',
    time: '00:00',
    status: 'scheduled',
    reason: null,
    outcome: null,
  },
  prescriptions: {
    issuedDate: '1970-01-01',
    validUntil: null,
    documentUrl: null,
    notes: null,
  },
  medications: {
    name: '[chiffré]',
    type: 'autre',
    dosage: '[chiffré]',
    quantity: 0,
    dailyRate: '1',
    startDate: '1970-01-01',
    alertDaysBefore: 7,
    skipDays: [],
  },
  documents: {
    type: 'autre',
    title: '[chiffré]',
    date: '1970-01-01',
    fileUrl: null,
    notes: null,
  },
};

/** Tables purgées par `wipe` : toutes les tables `user_id` de données métier (cascade pour les enfants). */
const WIPE_TABLES: OwnedTable[] = [
  schema.accountTransactions,
  schema.bankAccounts,
  schema.envelopes,
  schema.loans,
  schema.recurringEntries,
  schema.salaryArchives,
  schema.patients,
  schema.practitioners,
  schema.appointments,
  schema.prescriptions,
  schema.medications,
  schema.documents,
];

@Injectable()
export class EncryptionService {
  constructor(
    private readonly repo: AuthRepository,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  /**
   * Première pose des clés : libre. Remplacement de clés existantes : le mot de passe courant
   * est exigé, une session volée ne doit pas pouvoir rendre les données indéchiffrables.
   * Un compte sans mot de passe (OAuth seul) n'a rien à présenter : il reste sur la session.
   */
  async setKeys(
    userId: string,
    dto: SetupEncryptionKeysDto,
  ): Promise<Result<null>> {
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    if (user.encryptionVersion === 1 && user.password) {
      const verified =
        !!dto.currentPassword &&
        (await argon2.verify(user.password, dto.currentPassword));
      if (!verified)
        return fail(403, 'Mot de passe actuel requis', 'REAUTH_REQUIRED');
    }
    await this.repo.updateUser(userId, {
      encryptionSalt: dto.salt,
      wrappedMasterKey: dto.wrappedMasterKey,
      recoveryWrappedKey: dto.recoveryWrappedKey,
      encryptionVersion: 1,
    });
    return ok(null);
  }

  async setPassphrase(userId: string): Promise<Result<null>> {
    await this.repo.updateUser(userId, { encryptionPassphrase: true });
    return ok(null);
  }

  /**
   * Reset par code e-mail d'un compte E2EE, en une seule écriture : soit la clé maîtresse
   * ré-emballée avec le nouveau mot de passe (le client l'a ouverte avec la clé de récupération),
   * soit l'effacement des données chiffrées quand cette clé est perdue.
   */
  async resetPasswordWithRecovery(
    dto: ResetWithRecoveryDto,
  ): Promise<Result<null>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code, 'reset');
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    const encrypted = user.encryptionVersion === 1;
    const rewrap = !!dto.newSalt && !!dto.newWrappedMasterKey;
    if (encrypted && rewrap === !!dto.wipe) {
      return fail(
        400,
        'Clé ré-emballée ou effacement requis, pas les deux',
        'E2EE_RECOVERY_REQUIRED',
      );
    }
    const password = await argon2.hash(dto.newPassword);
    if (encrypted && dto.wipe) {
      await this.db.transaction(async (tx) => {
        await this.wipeIn(tx, user.id, { password, authVersion: 1 });
      });
    } else {
      await this.repo.updateUser(user.id, {
        password,
        authVersion: 1,
        ...(encrypted
          ? {
              encryptionSalt: dto.newSalt,
              wrappedMasterKey: dto.newWrappedMasterKey,
              encryptionPassphrase: false,
            }
          : {}),
      });
    }
    await this.repo.bumpSessionVersion(user.id);
    await this.repo.deleteCodes(dto.email, 'reset');
    return ok(null);
  }

  /**
   * Bascule un compte en E2EE : écrit les blobs envoyés par le client, neutralise les colonnes
   * en clair, puis pose les clés. Tout ou rien : une erreur en cours de route laissait avant
   * un compte mi-chiffré mi-clair avec `encryption_version = 0`.
   */
  async migrate(
    userId: string,
    dto: MigrateEncryptionDto,
  ): Promise<Result<null>> {
    // Rejouer la migration sur un compte déjà chiffré remplacerait ses clés sans réauthentification.
    const user = await this.repo.findById(userId);
    if (!user) return fail(404, 'Compte introuvable');
    if (user.encryptionVersion === 1)
      return fail(409, 'Chiffrement déjà actif', 'ALREADY_ENCRYPTED');
    await this.db.transaction(async (tx) => {
      for (const [tableName, rows] of Object.entries(dto.data)) {
        const mapping = MIGRATE_TABLES[tableName];
        if (!mapping) continue;
        const clear = CLEAR_COLUMNS[tableName] ?? {};
        for (const row of rows) {
          const scope =
            mapping.kind === 'own'
              ? eq(mapping.table.userId, userId)
              : inArray(
                  mapping.fk,
                  tx
                    .select({ id: mapping.parent.id })
                    .from(mapping.parent)
                    .where(eq(mapping.parent.userId, userId)),
                );
          await tx
            .update(mapping.table)
            .set({ encryptedData: row.encryptedData, ...clear })
            .where(and(eq(mapping.table.id, row.id), scope));
        }
      }
      await tx
        .update(schema.users)
        .set({
          encryptionSalt: dto.keyMaterial.salt,
          wrappedMasterKey: dto.keyMaterial.wrappedMasterKey,
          recoveryWrappedKey: dto.keyMaterial.recoveryWrappedKey,
          encryptionVersion: 1,
        })
        .where(eq(schema.users.id, userId));
    });
    return ok(null);
  }

  private async wipeIn(
    tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0],
    userId: string,
    extra: Partial<typeof schema.users.$inferInsert> = {},
  ): Promise<void> {
    for (const table of WIPE_TABLES) {
      await tx.delete(table).where(eq(table.userId, userId));
    }
    await tx
      .update(schema.users)
      .set({
        ...extra,
        encryptionSalt: null,
        wrappedMasterKey: null,
        recoveryWrappedKey: null,
        encryptionVersion: 0,
        encryptionPassphrase: false,
      })
      .where(eq(schema.users.id, userId));
  }
}
