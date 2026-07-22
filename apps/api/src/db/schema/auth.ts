import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const verificationCodePurposeEnum = pgEnum('verification_code_purpose', [
  'verification',
  'reset',
]);

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
  encryptionSalt: text('encryption_salt'),
  wrappedMasterKey: text('wrapped_master_key'),
  recoveryWrappedKey: text('recovery_wrapped_key'),
  encryptionVersion: integer('encryption_version').notNull().default(0),
  encryptionPassphrase: boolean('encryption_passphrase')
    .notNull()
    .default(false),
  isDemoAccount: boolean('is_demo_account').notNull().default(false),
  role: varchar('role', { length: 16 }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verificationCodes = pgTable('verification_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 6 }).notNull(),
  purpose: verificationCodePurposeEnum('purpose')
    .notNull()
    .default('verification'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
