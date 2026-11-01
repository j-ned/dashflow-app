import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  uuid,
  varchar,
  text,
  date,
  timestamp,
  integer,
  numeric,
  jsonb,
  boolean,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { users } from './auth';

export const practitionerTypeEnum = pgEnum('practitioner_type', [
  'generaliste',
  'pediatre',
  'psychiatre',
  'neurologue',
  'ophtalmologue',
  'dentiste',
  'orthodontiste',
  'orthophoniste',
  'psychologue',
  'psychomotricien',
  'ergotherapeute',
  'kinesitherapeute',
  'dermatologue',
  'cardiologue',
  'autre',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
]);

export const medicationTypeEnum = pgEnum('medication_type', [
  'comprime',
  'gelule',
  'sirop',
  'patch',
  'injection',
  'gouttes',
  'creme',
  'autre',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'compte_rendu',
  'facture',
  'bilan',
  'certificat',
  'courrier',
  'autre',
]);

export const reminderTargetEnum = pgEnum('reminder_target', [
  'medication',
  'appointment',
]);

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 255 }).notNull(),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    // Nullable : un membre du foyer créé côté budget (core) n'a pas de date de naissance ;
    // seul un patient médical (Premium) la renseigne.
    birthDate: date('birth_date'),
    color: varchar('color', { length: 7 }),
    notes: text('notes'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('patients_user_created_idx').on(t.userId, t.createdAt, t.id)],
);

export const practitioners = pgTable(
  'practitioners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: practitionerTypeEnum('type').notNull(),
    phone: varchar('phone', { length: 50 }),
    email: varchar('email', { length: 255 }),
    address: text('address'),
    bookingUrl: text('booking_url'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('practitioners_user_created_idx').on(t.userId, t.createdAt, t.id),
  ],
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    practitionerId: uuid('practitioner_id')
      .notNull()
      .references(() => practitioners.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    time: varchar('time', { length: 5 }).notNull(),
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    reason: text('reason'),
    outcome: text('outcome'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('appointments_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('appointments_patient_idx').on(t.patientId),
    index('appointments_practitioner_idx').on(t.practitionerId),
  ],
);

export const prescriptions = pgTable(
  'prescriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'cascade',
    }),
    practitionerId: uuid('practitioner_id').references(() => practitioners.id, {
      onDelete: 'set null',
    }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    issuedDate: date('issued_date').notNull(),
    validUntil: date('valid_until'),
    documentUrl: text('document_url'),
    notes: text('notes'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('prescriptions_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('prescriptions_patient_idx').on(t.patientId),
    index('prescriptions_appointment_idx').on(t.appointmentId),
    index('prescriptions_practitioner_idx').on(t.practitionerId),
  ],
);

export const medications = pgTable(
  'medications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    prescriptionId: uuid('prescription_id').references(() => prescriptions.id, {
      onDelete: 'cascade',
    }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    type: medicationTypeEnum('type').notNull(),
    dosage: varchar('dosage', { length: 100 }).notNull(),
    quantity: integer('quantity').notNull().default(0),
    dailyRate: numeric('daily_rate', { precision: 5, scale: 2 })
      .notNull()
      .default('1'),
    startDate: date('start_date').notNull(),
    alertDaysBefore: integer('alert_days_before').notNull().default(7),
    skipDays: jsonb('skip_days').notNull().default([]),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('medications_daily_rate_positive', sql`${t.dailyRate} > 0`),
    index('medications_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('medications_patient_idx').on(t.patientId),
    index('medications_prescription_idx').on(t.prescriptionId),
  ],
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'cascade' }),
    practitionerId: uuid('practitioner_id').references(() => practitioners.id, {
      onDelete: 'set null',
    }),
    type: documentTypeEnum('type').notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    date: date('date').notNull(),
    fileUrl: text('file_url'),
    notes: text('notes'),
    encryptedData: text('encrypted_data'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('documents_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('documents_patient_idx').on(t.patientId),
    index('documents_practitioner_idx').on(t.practitionerId),
  ],
);

export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    target: reminderTargetEnum('target').notNull(),
    medicationId: uuid('medication_id').references(() => medications.id, {
      onDelete: 'cascade',
    }),
    appointmentId: uuid('appointment_id').references(() => appointments.id, {
      onDelete: 'cascade',
    }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('reminders_user_created_idx').on(t.userId, t.createdAt, t.id),
    index('reminders_medication_idx').on(t.medicationId),
    index('reminders_appointment_idx').on(t.appointmentId),
    check(
      'reminders_target_has_ref',
      sql`(${t.target} = 'medication' and ${t.medicationId} is not null) or (${t.target} = 'appointment' and ${t.appointmentId} is not null)`,
    ),
  ],
);
