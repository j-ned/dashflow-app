export const NOTICE_REASONS = [
  'reconnect',
  'enable_encryption',
  'recovery_key',
  'enable_2fa',
] as const;
export type NoticeReason = (typeof NOTICE_REASONS)[number];

export type SecurityIssue = {
  readonly reason: NoticeReason;
  readonly severity: 'action' | 'recommended';
};

export type AccountSecurity = {
  /**
   * `exempt` : compte de démonstration, jamais relancé.
   * `unverified` : e-mail jamais vérifié (faux compte, faute de frappe, inscription abandonnée) —
   * jamais relancé, et seul état qu'un administrateur peut supprimer.
   */
  readonly status: 'ok' | 'recommended' | 'action' | 'exempt' | 'unverified';
  readonly issues: readonly SecurityIssue[];
};

export type AdminUserView = {
  readonly id: string;
  readonly email: string;
  readonly role: 'user' | 'admin';
  readonly isDemoAccount: boolean;
  readonly createdAt: string;
  readonly security: AccountSecurity;
  /** Dernière relance envoyée dans les 7 derniers jours, s'il y en a une. */
  readonly lastNotice: { readonly reason: NoticeReason; readonly at: string } | null;
};

export type AdminUsersPage = {
  readonly items: readonly AdminUserView[];
  readonly total: number;
};

export type NoticeSummary = Readonly<
  Record<NoticeReason, { readonly eligible: number; readonly onCooldown: number }>
>;

export type NoticeSkipReason = 'not_found' | 'not_eligible' | 'cooldown' | 'send_failed';

export type SendNoticesResult = {
  readonly reason: NoticeReason;
  readonly sent: readonly { readonly id: string; readonly email: string }[];
  readonly skipped: readonly {
    readonly id: string;
    readonly email: string | null;
    readonly why: NoticeSkipReason;
  }[];
};

export type DeleteSkipReason = 'not_found' | 'self' | 'admin' | 'demo' | 'verified';

export type DeleteUsersResult = {
  readonly deleted: readonly { readonly id: string; readonly email: string }[];
  readonly skipped: readonly {
    readonly id: string;
    readonly email: string | null;
    readonly why: DeleteSkipReason;
  }[];
};

/** Un administrateur ne peut supprimer que ces comptes-là ; le serveur le revérifie. */
export const isDeletable = (user: AdminUserView): boolean =>
  user.security.status === 'unverified' && user.role !== 'admin' && !user.isDemoAccount;

export const isEligibleFor = (user: AdminUserView, reason: NoticeReason): boolean =>
  user.security.issues.some((issue) => issue.reason === reason);
