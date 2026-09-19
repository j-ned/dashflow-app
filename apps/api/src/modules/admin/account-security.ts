/**
 * État de sécurité d'un compte, vu de l'administration : ce qui manque pour qu'il soit « sécurisé
 * et à jour », et le motif de relance par e-mail qui correspond à chaque manque.
 *
 * Calculé uniquement à partir de colonnes techniques de `users` — jamais de données métier.
 */
export const NOTICE_REASONS = [
  'reconnect',
  'enable_encryption',
  'recovery_key',
  'enable_2fa',
] as const;
export type NoticeReason = (typeof NOTICE_REASONS)[number];

export type SecurityIssue = {
  /** Motif de relance qui traite ce manque. */
  reason: NoticeReason;
  /** `action` : le compte n'est pas à jour. `recommended` : conseillé, sans urgence. */
  severity: 'action' | 'recommended';
};

export type AccountSecurity = {
  /**
   * `exempt` : compte de démonstration, hors périmètre.
   * `unverified` : e-mail jamais vérifié — le compte n'appartient encore à personne (faute de
   * frappe, adresse inventée, inscription abandonnée). Il ne reçoit aucune relance : l'adresse
   * peut être celle d'un inconnu. C'est le seul état qu'un administrateur peut supprimer.
   */
  status: 'ok' | 'recommended' | 'action' | 'exempt' | 'unverified';
  issues: SecurityIssue[];
};

export type AccountSecurityInput = {
  isDemoAccount: boolean;
  emailVerified: boolean;
  hasPassword: boolean;
  authVersion: number;
  encryptionVersion: number;
  hasRecoveryKey: boolean;
  totpEnabled: boolean;
};

export function assessAccountSecurity(
  u: AccountSecurityInput,
): AccountSecurity {
  if (u.isDemoAccount) return { status: 'exempt', issues: [] };
  if (!u.emailVerified) return { status: 'unverified', issues: [] };

  const issues: SecurityIssue[] = [];
  // Mot de passe encore envoyé tel quel au serveur : bascule vers la clé dérivée au prochain login.
  if (u.hasPassword && u.authVersion === 0) {
    issues.push({ reason: 'reconnect', severity: 'action' });
  }
  if (u.encryptionVersion === 0) {
    issues.push({ reason: 'enable_encryption', severity: 'action' });
  } else if (!u.hasRecoveryKey) {
    issues.push({ reason: 'recovery_key', severity: 'action' });
  }
  if (!u.totpEnabled) {
    issues.push({ reason: 'enable_2fa', severity: 'recommended' });
  }

  const status = issues.some((i) => i.severity === 'action')
    ? 'action'
    : issues.length > 0
      ? 'recommended'
      : 'ok';
  return { status, issues };
}

/** Un compte ne reçoit un motif que s'il est réellement concerné : pas de relance « au cas où ». */
export function isEligibleFor(
  security: AccountSecurity,
  reason: NoticeReason,
): boolean {
  return security.issues.some((i) => i.reason === reason);
}

/** Délai minimum entre deux relances du même motif au même compte. */
export const NOTICE_COOLDOWN_DAYS = 7;

/** Plafond par envoi : l'outil sert à relancer des comptes, pas à faire une campagne. */
export const NOTICE_MAX_RECIPIENTS = 100;

/** Âge à partir duquel un compte jamais vérifié est purgé automatiquement. */
export const UNVERIFIED_PURGE_DAYS = 7;

/** Plafond par suppression manuelle. */
export const DELETE_MAX_ACCOUNTS = 100;

export const noticeEventType = (reason: NoticeReason) =>
  `admin_notice_${reason}` as const;
