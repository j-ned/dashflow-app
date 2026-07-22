import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { and, eq } from 'drizzle-orm';
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

type MigrateTable = PgTable & { id: PgColumn; userId?: PgColumn };

const MIGRATE_TABLES: Record<
  string,
  { table: MigrateTable; hasUserId: boolean }
> = {
  bankAccounts: { table: schema.bankAccounts, hasUserId: true },
  envelopes: { table: schema.envelopes, hasUserId: true },
  envelopeTransactions: {
    table: schema.envelopeTransactions,
    hasUserId: false,
  },
  loans: { table: schema.loans, hasUserId: true },
  loanTransactions: { table: schema.loanTransactions, hasUserId: false },
  recurringEntries: { table: schema.recurringEntries, hasUserId: true },
  salaryArchives: { table: schema.salaryArchives, hasUserId: true },
  patients: { table: schema.patients, hasUserId: true },
  practitioners: { table: schema.practitioners, hasUserId: true },
  appointments: { table: schema.appointments, hasUserId: true },
  prescriptions: { table: schema.prescriptions, hasUserId: true },
  medications: { table: schema.medications, hasUserId: true },
  documents: { table: schema.documents, hasUserId: true },
};

const CLEAR_COLUMNS: Record<string, Record<string, unknown>> = {
  bankAccounts: {
    name: '[chiffré]',
    type: 'courant',
    color: null,
    dotColor: null,
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

const WIPE_TABLES: (PgTable & { userId: PgColumn })[] = [
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

  async setKeys(
    userId: string,
    dto: SetupEncryptionKeysDto,
  ): Promise<Result<null>> {
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

  async resetPasswordWithRecovery(
    dto: ResetWithRecoveryDto,
  ): Promise<Result<null>> {
    const valid = await this.repo.findValidCode(dto.email, dto.code, 'reset');
    if (!valid) return fail(400, 'Code invalide ou expiré');
    const user = await this.repo.findByEmail(dto.email);
    if (!user) return fail(404, 'Compte introuvable');
    const patch: Record<string, unknown> = {
      password: await argon2.hash(dto.newPassword),
    };
    if (dto.newSalt && dto.newWrappedMasterKey) {
      patch.encryptionSalt = dto.newSalt;
      patch.wrappedMasterKey = dto.newWrappedMasterKey;
    }
    await this.repo.updateUser(user.id, patch);
    await this.repo.deleteCodes(dto.email, 'reset');
    return ok(null);
  }

  async migrate(
    userId: string,
    dto: MigrateEncryptionDto,
  ): Promise<Result<null>> {
    for (const [tableName, rows] of Object.entries(dto.data)) {
      const mapping = MIGRATE_TABLES[tableName];
      if (!mapping) continue;
      const clear = CLEAR_COLUMNS[tableName] ?? {};
      for (const row of rows) {
        const conditions = [eq(mapping.table.id, row.id)];
        if (mapping.hasUserId)
          conditions.push(eq(mapping.table.userId!, userId));
        await this.db
          .update(mapping.table)
          .set({ encryptedData: row.encryptedData, ...clear })
          .where(and(...conditions));
      }
    }
    await this.repo.updateUser(userId, {
      encryptionSalt: dto.keyMaterial.salt,
      wrappedMasterKey: dto.keyMaterial.wrappedMasterKey,
      recoveryWrappedKey: dto.keyMaterial.recoveryWrappedKey,
      encryptionVersion: 1,
    });
    return ok(null);
  }

  async wipe(userId: string): Promise<Result<null>> {
    for (const table of WIPE_TABLES) {
      await this.db.delete(table).where(eq(table.userId, userId));
    }
    await this.repo.updateUser(userId, {
      encryptionSalt: null,
      wrappedMasterKey: null,
      recoveryWrappedKey: null,
      encryptionVersion: 0,
    });
    return ok(null);
  }
}
