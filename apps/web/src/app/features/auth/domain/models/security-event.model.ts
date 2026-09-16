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

export type SecurityEvent = {
  readonly id: string;
  /** Type connu, ou chaîne libre si le serveur en ajoute un que ce front ne connaît pas encore. */
  readonly type: SecurityEventType | string;
  readonly ip: string | null;
  readonly userAgent: string | null;
  readonly at: string;
};

/** Événements qui méritent d'attirer l'œil (échec, usage d'un secours, changement de secret). */
export const ATTENTION_EVENT_TYPES: ReadonlySet<string> = new Set([
  'login_failed',
  'backup_code_used',
  'password_reset',
  'recovery_reset',
  'totp_disabled',
  'encryption_wiped',
]);
