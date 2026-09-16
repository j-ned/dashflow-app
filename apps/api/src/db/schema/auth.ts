import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
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
  // Incrémenté à chaque événement de sécurité (logout, reset/changement de mot de passe,
  // désactivation 2FA) : tout JWT dont le claim `sv` diffère est refusé → révocation réelle.
  sessionVersion: integer('session_version').notNull().default(0),
  // Dernier pas TOTP (30 s) accepté : un code intercepté ne peut pas être rejoué.
  totpLastUsedStep: integer('totp_last_used_step'),
  role: varchar('role', { length: 16 }).notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const verificationCodes = pgTable(
  'verification_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull(),
    // SHA-256 (hex) du code à 6 chiffres : une lecture DB ne donne pas le code.
    code: varchar('code', { length: 64 }).notNull(),
    // Échecs de vérification ; le code est détruit au 5e (anti brute-force distribué par IP).
    attempts: integer('attempts').notNull().default(0),
    purpose: verificationCodePurposeEnum('purpose')
      .notNull()
      .default('verification'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('verification_codes_email_purpose_idx').on(t.email, t.purpose)],
);

/**
 * Codes de secours 2FA : 10 codes à usage unique, stockés en HMAC-SHA256 (clé serveur). Un code
 * consommé garde sa ligne (`used_at`) pour compter ce qui reste ; la régénération remplace tout.
 */
export const totpBackupCodes = pgTable(
  'totp_backup_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: varchar('code_hash', { length: 64 }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('totp_backup_codes_user_idx').on(t.userId),
    uniqueIndex('totp_backup_codes_user_hash_uq').on(t.userId, t.codeHash),
  ],
);

export const SECURITY_EVENT_TYPES = [
  'email_verified',
  'login_success',
  'login_failed',
  'login_oauth',
  'backup_code_used',
  'logout',
  'password_changed',
  'password_set',
  'password_reset_requested',
  'password_reset',
  'totp_enabled',
  'totp_disabled',
  'backup_codes_regenerated',
  'encryption_keys_set',
  'encryption_migrated',
  'encryption_wiped',
  'recovery_reset',
  'account_deleted',
] as const;
export type SecurityEventType = (typeof SECURITY_EVENT_TYPES)[number];

/**
 * Journal des événements de sécurité (ASVS 7.1) : qui s'est connecté, d'où, ce qui a changé sur
 * le compte. Consultable par l'utilisateur (« activité récente »). Aucune donnée métier, aucun
 * e-mail inconnu (un échec sur un compte inexistant n'est pas journalisé : anti-énumération).
 */
export const securityEvents = pgTable(
  'security_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 48 }).notNull(),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 255 }),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('security_events_user_at_idx').on(t.userId, t.at)],
);
