import { z } from 'zod';

// ── Helpers ──

const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().nullable().optional();
const email = z.string().email('Format email invalide').max(255);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur invalide (#RRGGBB)').nullable().optional();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)');
const timeStr = z.string().regex(/^\d{2}:\d{2}$/, 'Format heure invalide (HH:MM)');
const amount = z.union([z.string(), z.number()]).transform(String);

const MIN_PASSWORD_LENGTH = 12;

// ── Auth ──

export const registerSchema = z.object({
  email,
  password: z.string().min(MIN_PASSWORD_LENGTH, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres`),
  displayName: z.string().max(255).optional(),
});

export const verifySchema = z.object({
  email,
  code: z.string().length(6, 'Code a 6 chiffres requis'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Mot de passe requis'),
  totpCode: z.string().length(6).optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z.object({
  email,
  code: z.string().length(6),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres`),
});

export const updateProfileSchema = z.object({
  displayName: z.string().max(255).optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mot de passe actuel requis'),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres`),
});

export const setPasswordSchema = z.object({
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caracteres`),
});

// ── Budget: Envelopes ──

const ENVELOPE_TYPES = ['épargne', 'impôts', 'équipement', 'vacances'] as const;

export const createEnvelopeSchema = z.object({
  memberId: optionalUuid,
  name: z.string().min(1).max(255),
  type: z.enum(ENVELOPE_TYPES),
  balance: amount.optional().default('0'),
  target: amount.nullable().optional(),
  color,
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const creditEnvelopeSchema = z.object({
  amount: z.number(),
  date: dateStr.optional(),
});

export const envelopeTransactionSchema = z.object({
  amount: z.number(),
  date: dateStr,
});

// ── Budget: Loans ──

const LOAN_DIRECTIONS = ['lent', 'borrowed'] as const;

export const createLoanSchema = z.object({
  memberId: optionalUuid,
  person: z.string().min(1).max(255),
  direction: z.enum(LOAN_DIRECTIONS),
  amount,
  remaining: amount,
  description: z.string().max(1000).nullable().optional(),
  date: dateStr,
  dueDate: dateStr.nullable().optional(),
  dueDay: z.number().int().min(1).max(31).nullable().optional(),
});

export const loanPaymentSchema = z.object({
  amount: z.number().positive('Le montant doit etre positif'),
  date: dateStr.optional(),
});

// ── Budget: Bank Accounts ──

export const createBankAccountSchema = z.object({
  name: z.string().min(1).max(255),
  color,
  dotColor: color,
});

// ── Budget: Recurring Entries ──

const RECURRING_TYPES = ['income', 'expense', 'annual_expense', 'spending'] as const;

export const createRecurringEntrySchema = z.object({
  memberId: optionalUuid,
  accountId: optionalUuid,
  label: z.string().min(1).max(255),
  amount,
  type: z.enum(RECURRING_TYPES),
  dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
  date: dateStr.nullable().optional(),
  category: z.string().max(100).nullable().optional(),
});

// ── Budget: Salary Archives ──

export const createSalaryArchiveSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format mois invalide (YYYY-MM)'),
  salary: amount,
  totalExpenses: amount.optional().default('0'),
  totalSpendings: amount.optional().default('0'),
  spendings: z.string().optional().default('[]'),
  accountId: z.string().uuid().nullable().optional(),
});

// ── Medical: Patients ──

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  birthDate: dateStr,
  notes: z.string().max(2000).nullable().optional(),
});

// ── Medical: Practitioners ──

const PRACTITIONER_TYPES = [
  'generaliste', 'pediatre', 'psychiatre', 'neurologue', 'ophtalmologue',
  'dentiste', 'orthodontiste', 'orthophoniste', 'psychologue', 'psychomotricien',
  'ergotherapeute', 'kinesitherapeute', 'dermatologue', 'cardiologue', 'autre',
] as const;

export const createPractitionerSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(PRACTITIONER_TYPES),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().max(255).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  bookingUrl: z.string().url().max(1000).nullable().optional(),
});

// ── Medical: Appointments ──

const APPOINTMENT_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const;

export const createAppointmentSchema = z.object({
  patientId: uuid,
  practitionerId: uuid,
  date: dateStr,
  time: timeStr,
  status: z.enum(APPOINTMENT_STATUSES).optional().default('scheduled'),
  reason: z.string().max(1000).nullable().optional(),
  outcome: z.string().max(2000).nullable().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});

// ── Medical: Prescriptions ──

export const createPrescriptionSchema = z.object({
  appointmentId: optionalUuid,
  practitionerId: optionalUuid,
  patientId: uuid,
  issuedDate: dateStr,
  validUntil: dateStr.nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

// ── Medical: Medications ──

const MEDICATION_TYPES = ['comprime', 'gelule', 'sirop', 'patch', 'injection', 'gouttes', 'creme', 'autre'] as const;

export const createMedicationSchema = z.object({
  prescriptionId: optionalUuid,
  patientId: uuid,
  name: z.string().min(1).max(255),
  type: z.enum(MEDICATION_TYPES),
  dosage: z.string().min(1).max(100),
  quantity: z.number().int().min(0).optional().default(0),
  dailyRate: amount.optional().default('1'),
  startDate: dateStr,
  alertDaysBefore: z.number().int().min(0).max(90).optional().default(7),
  skipDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
});

export const refillMedicationSchema = z.object({
  quantity: z.number().int().positive('La quantite doit etre positive'),
});

// ── Medical: Documents ──

const DOCUMENT_TYPES = ['compte_rendu', 'facture', 'bilan', 'certificat', 'courrier', 'autre'] as const;

export const createDocumentSchema = z.object({
  patientId: uuid,
  practitionerId: optionalUuid,
  type: z.enum(DOCUMENT_TYPES),
  title: z.string().min(1).max(255),
  date: dateStr,
  notes: z.string().max(2000).nullable().optional(),
});

// ── Medical: Reminders ──

const REMINDER_TYPES = ['email', 'ical'] as const;
const REMINDER_TARGETS = ['medication', 'appointment'] as const;

export const createReminderSchema = z.object({
  type: z.enum(REMINDER_TYPES),
  target: z.enum(REMINDER_TARGETS),
  medicationId: optionalUuid,
  appointmentId: optionalUuid,
  recipientEmail: email,
  enabled: z.boolean().optional().default(true),
});

// ── Medical: Shared Access ──

export const createSharedAccessSchema = z.object({
  invitedEmail: email,
});

// ── E2EE: Encryption Keys ──

export const setupEncryptionKeysSchema = z.object({
  salt: z.string().min(1),
  wrappedMasterKey: z.string().min(1),
  recoveryWrappedKey: z.string().min(1),
});

export const updateWrappedKeySchema = z.object({
  newSalt: z.string().min(1),
  newWrappedMasterKey: z.string().min(1),
});

export const encryptionPassphraseSchema = z.object({
  passphrase: z.string().min(8, 'La passphrase doit faire au moins 8 caracteres'),
});

export const migrateEncryptionSchema = z.object({
  keyMaterial: setupEncryptionKeysSchema,
  data: z.record(z.string(), z.array(z.object({
    id: z.string().uuid(),
    encryptedData: z.string().min(1),
  }))),
});

// ── E2EE: Encrypted CRUD schemas ──

export const createEncryptedBankAccountSchema = z.object({
  encryptedData: z.string().min(1),
});

export const createEncryptedEnvelopeSchema = z.object({
  memberId: optionalUuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedEnvelopeTransactionSchema = z.object({
  encryptedData: z.string().min(1),
});

export const createEncryptedLoanSchema = z.object({
  memberId: optionalUuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedLoanTransactionSchema = z.object({
  encryptedData: z.string().min(1),
});

export const createEncryptedRecurringEntrySchema = z.object({
  memberId: optionalUuid,
  accountId: optionalUuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedSalaryArchiveSchema = z.object({
  accountId: optionalUuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedPatientSchema = z.object({
  encryptedData: z.string().min(1),
});

export const createEncryptedPractitionerSchema = z.object({
  encryptedData: z.string().min(1),
});

export const createEncryptedAppointmentSchema = z.object({
  patientId: uuid,
  practitionerId: uuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedPrescriptionSchema = z.object({
  appointmentId: optionalUuid,
  practitionerId: optionalUuid,
  patientId: uuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedMedicationSchema = z.object({
  prescriptionId: optionalUuid,
  patientId: uuid,
  encryptedData: z.string().min(1),
});

export const createEncryptedDocumentSchema = z.object({
  patientId: uuid,
  practitionerId: optionalUuid,
  encryptedData: z.string().min(1),
});

// ── Members ──

export const updateMemberColorSchema = z.object({
  color: color.transform(v => v ?? null),
});

// ── Validation helper ──

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  const firstError = result.error.issues[0];
  return { success: false, error: firstError?.message ?? 'Donnees invalides' };
}
