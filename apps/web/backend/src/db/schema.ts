import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  date,
  timestamp,
  jsonb,
  pgEnum,
  boolean,
} from 'drizzle-orm/pg-core';

// ── Enums ──

export const envelopeTypeEnum = pgEnum('envelope_type', ['épargne', 'impôts', 'équipement', 'vacances']);

export const loanDirectionEnum = pgEnum('loan_direction', ['lent', 'borrowed']);

export const recurringEntryTypeEnum = pgEnum('recurring_entry_type', ['income', 'expense', 'annual_expense', 'spending', 'transfer']);

export const consumableCategoryEnum = pgEnum('consumable_category', [
  'ink',
  'toner',
  'paper',
  'other',
]);

// ── Users ──

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: text('password'),
  googleId: varchar('google_id', { length: 255 }).unique(),
  displayName: varchar('display_name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  totpSecret: text('totp_secret'),
  totpEnabled: timestamp('totp_enabled', { withTimezone: true }),
  // E2EE fields
  encryptionSalt: text('encryption_salt'),
  wrappedMasterKey: text('wrapped_master_key'),
  recoveryWrappedKey: text('recovery_wrapped_key'),
  encryptionVersion: integer('encryption_version').notNull().default(0),
  encryptionPassphrase: boolean('encryption_passphrase').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Verification Codes ──

export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Budget: Bank Accounts ──

export const bankAccounts = pgTable('bank_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  initialBalance: numeric('initial_balance', { precision: 12, scale: 2 }).notNull().default('0'),
  color: varchar('color', { length: 7 }),
  dotColor: varchar('dot_color', { length: 7 }),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Budget: Envelopes ──

export const envelopes = pgTable('envelopes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => patients.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: envelopeTypeEnum('type').notNull(),
  balance: numeric('balance', { precision: 12, scale: 2 }).notNull().default('0'),
  target: numeric('target', { precision: 12, scale: 2 }),
  color: varchar('color', { length: 7 }),
  dueDay: integer('due_day'),
  encryptedData: text('encrypted_data'),
});

// ── Budget: Envelope Transactions ──

export const envelopeTransactions = pgTable('envelope_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  envelopeId: uuid('envelope_id').notNull().references(() => envelopes.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull(),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Budget: Loans ──

export const loans = pgTable('loans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => patients.id, { onDelete: 'set null' }),
  person: varchar('person', { length: 255 }).notNull(),
  direction: loanDirectionEnum('direction').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  remaining: numeric('remaining', { precision: 12, scale: 2 }).notNull(),
  description: text('description'),
  date: date('date').notNull(),
  dueDate: date('due_date'),
  dueDay: integer('due_day'),
  encryptedData: text('encrypted_data'),
});

// ── Budget: Loan Transactions ──

export const loanTransactions = pgTable('loan_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  loanId: uuid('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  date: date('date').notNull(),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Budget: Consumables ──

export const consumables = pgTable('consumables', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => patients.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  category: consumableCategoryEnum('category').notNull(),
  quantity: integer('quantity').notNull().default(0),
  minThreshold: integer('min_threshold').notNull().default(0),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull().default('0'),
  lastRestocked: timestamp('last_restocked', { withTimezone: true }),
  installedAt: timestamp('installed_at', { withTimezone: true }),
  estimatedLifetimeDays: integer('estimated_lifetime_days'),
});

// ── Budget: Recurring Entries ──

export const recurringEntries = pgTable('recurring_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id').references(() => patients.id, { onDelete: 'set null' }),
  accountId: uuid('account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  label: varchar('label', { length: 255 }).notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  type: recurringEntryTypeEnum('type').notNull(),
  dayOfMonth: integer('day_of_month'),
  date: date('date'),
  endDate: date('end_date'),
  toAccountId: uuid('to_account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  category: varchar('category', { length: 100 }),
  payslipKey: text('payslip_key'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Budget: Salary Archives ──

export const salaryArchives = pgTable('salary_archives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').references(() => bankAccounts.id, { onDelete: 'set null' }),
  month: varchar('month', { length: 7 }).notNull(), // '2026-03'
  salary: numeric('salary', { precision: 12, scale: 2 }).notNull(),
  totalExpenses: numeric('total_expenses', { precision: 12, scale: 2 }).notNull().default('0'),
  totalSpendings: numeric('total_spendings', { precision: 12, scale: 2 }).notNull().default('0'),
  spendings: jsonb('spendings').notNull().default([]), // snapshot: [{label, amount, date, category}]
  payslipKey: text('payslip_key'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Enums ──

export const practitionerTypeEnum = pgEnum('practitioner_type', [
  'generaliste', 'pediatre', 'psychiatre', 'neurologue', 'ophtalmologue',
  'dentiste', 'orthodontiste', 'orthophoniste', 'psychologue', 'psychomotricien',
  'ergotherapeute', 'kinesitherapeute', 'dermatologue', 'cardiologue', 'autre',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled', 'completed', 'cancelled', 'no_show',
]);

export const medicationTypeEnum = pgEnum('medication_type', [
  'comprime', 'gelule', 'sirop', 'patch', 'injection', 'gouttes', 'creme', 'autre',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'compte_rendu', 'facture', 'bilan', 'certificat', 'courrier', 'autre',
]);

export const reminderTypeEnum = pgEnum('reminder_type', ['email', 'ical']);

export const reminderTargetEnum = pgEnum('reminder_target', ['medication', 'appointment']);

// ── Medical: Patients ──

export const patients = pgTable('patients', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  firstName: varchar('first_name', { length: 255 }).notNull(),
  lastName: varchar('last_name', { length: 255 }).notNull(),
  birthDate: date('birth_date').notNull(),
  color: varchar('color', { length: 7 }),
  notes: text('notes'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Practitioners ──

export const practitioners = pgTable('practitioners', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: practitionerTypeEnum('type').notNull(),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  address: text('address'),
  bookingUrl: text('booking_url'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Appointments ──

export const appointments = pgTable('appointments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  practitionerId: uuid('practitioner_id').notNull().references(() => practitioners.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  time: varchar('time', { length: 5 }).notNull(),
  status: appointmentStatusEnum('status').notNull().default('scheduled'),
  reason: text('reason'),
  outcome: text('outcome'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Prescriptions ──

export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  practitionerId: uuid('practitioner_id').references(() => practitioners.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  issuedDate: date('issued_date').notNull(),
  validUntil: date('valid_until'),
  documentUrl: text('document_url'),
  notes: text('notes'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Medications ──

export const medications = pgTable('medications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  prescriptionId: uuid('prescription_id').references(() => prescriptions.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: medicationTypeEnum('type').notNull(),
  dosage: varchar('dosage', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull().default(0),
  dailyRate: numeric('daily_rate', { precision: 5, scale: 2 }).notNull().default('1'),
  startDate: date('start_date').notNull(),
  alertDaysBefore: integer('alert_days_before').notNull().default(7),
  skipDays: jsonb('skip_days').notNull().default([]),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Documents ──

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  patientId: uuid('patient_id').notNull().references(() => patients.id, { onDelete: 'cascade' }),
  practitionerId: uuid('practitioner_id').references(() => practitioners.id, { onDelete: 'set null' }),
  type: documentTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  date: date('date').notNull(),
  fileUrl: text('file_url'),
  notes: text('notes'),
  encryptedData: text('encrypted_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Reminders ──

export const reminders = pgTable('reminders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: reminderTypeEnum('type').notNull(),
  target: reminderTargetEnum('target').notNull(),
  medicationId: uuid('medication_id').references(() => medications.id, { onDelete: 'cascade' }),
  appointmentId: uuid('appointment_id').references(() => appointments.id, { onDelete: 'cascade' }),
  recipientEmail: varchar('recipient_email', { length: 255 }).notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Medical: Shared Access ──

export const sharedAccess = pgTable('shared_access', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedEmail: varchar('invited_email', { length: 255 }).notNull(),
  calendarToken: varchar('calendar_token', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
