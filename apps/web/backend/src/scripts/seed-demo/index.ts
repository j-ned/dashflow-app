// backend/src/scripts/seed-demo/index.ts
import { hash } from 'argon2';
import { eq, sql } from 'drizzle-orm';
import { db } from '@db/client';
import {
  users,
  patients,
  practitioners,
  appointments,
  bankAccounts,
  envelopes,
  envelopeTransactions,
  loans,
  loanTransactions,
  recurringEntries,
  salaryArchives,
  medications,
  prescriptions,
  documents,
  reminders,
} from '@db/schema';
import { makeRng } from './rng.js';
import { seedFamily } from './builders/family.js';
import { seedBudget } from './builders/budget.js';
import { seedMedical } from './builders/medical.js';

const DEMO_EMAIL = 'demo@dashflow.app';
const DEMO_PASSWORD_PLAIN = 'demo';
const SEED = 42;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ensureDemoUser(tx: Tx): Promise<string> {
  const [existing] = await tx.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) {
    if (!existing.isDemoAccount) {
      throw new Error(`User ${DEMO_EMAIL} exists but is not flagged as demo. Aborting.`);
    }
    return existing.id;
  }
  const hashedPassword = await hash(DEMO_PASSWORD_PLAIN);
  const [created] = await tx
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      password: hashedPassword,
      displayName: 'Compte démo',
      emailVerified: new Date(),
      isDemoAccount: true,
    })
    .returning({ id: users.id });
  return created!.id;
}

async function wipeDemoData(tx: Tx, userId: string): Promise<void> {
  // Order matters: children first, parents last.
  await tx.delete(reminders).where(eq(reminders.userId, userId));
  await tx.execute(sql`DELETE FROM envelope_transactions WHERE envelope_id IN (SELECT id FROM envelopes WHERE user_id = ${userId})`);
  await tx.execute(sql`DELETE FROM loan_transactions     WHERE loan_id     IN (SELECT id FROM loans     WHERE user_id = ${userId})`);
  await tx.delete(documents).where(eq(documents.userId, userId));
  await tx.delete(prescriptions).where(eq(prescriptions.userId, userId));
  await tx.delete(medications).where(eq(medications.userId, userId));
  await tx.delete(appointments).where(eq(appointments.userId, userId));
  await tx.delete(salaryArchives).where(eq(salaryArchives.userId, userId));
  await tx.delete(recurringEntries).where(eq(recurringEntries.userId, userId));
  await tx.delete(loans).where(eq(loans.userId, userId));
  await tx.delete(envelopes).where(eq(envelopes.userId, userId));
  await tx.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
  await tx.delete(patients).where(eq(patients.userId, userId));
  await tx.delete(practitioners).where(eq(practitioners.userId, userId));
}

async function validate(tx: Tx, userId: string): Promise<void> {
  const counts = {
    patients:           (await tx.select().from(patients).where(eq(patients.userId, userId))).length,
    practitioners:      (await tx.select().from(practitioners).where(eq(practitioners.userId, userId))).length,
    bankAccounts:       (await tx.select().from(bankAccounts).where(eq(bankAccounts.userId, userId))).length,
    envelopes:          (await tx.select().from(envelopes).where(eq(envelopes.userId, userId))).length,
    recurringEntries:   (await tx.select().from(recurringEntries).where(eq(recurringEntries.userId, userId))).length,
    appointments:       (await tx.select().from(appointments).where(eq(appointments.userId, userId))).length,
    medications:        (await tx.select().from(medications).where(eq(medications.userId, userId))).length,
    documents:          (await tx.select().from(documents).where(eq(documents.userId, userId))).length,
  };
  const expected = { patients: 4, practitioners: 8, bankAccounts: 3, envelopes: 6, recurringEntries: 15, appointments: 20, medications: 6, documents: 8 };
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k as keyof typeof counts] !== v) {
      throw new Error(`Validation failed: expected ${k}=${v}, got ${counts[k as keyof typeof counts]}`);
    }
  }
  console.log('[seed-demo] validation OK', counts);
}

export async function runDemoReset(opts: { wipeFirst?: boolean } = { wipeFirst: true }): Promise<void> {
  await db.transaction(async (tx) => {
    const userId = await ensureDemoUser(tx);
    if (opts.wipeFirst) await wipeDemoData(tx, userId);
    const rng = makeRng(SEED);
    const family = await seedFamily(tx, userId);
    await seedBudget(tx, userId, family, rng);
    await seedMedical(tx, userId, family, rng);
    await validate(tx, userId);
  });
}
