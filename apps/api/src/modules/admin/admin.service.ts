import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAILER, type Mailer } from '../../mail/mailer';
import {
  AdminRepository,
  type AdminNoticeRow,
  type AdminUserRow,
} from './admin.repository';
import {
  NOTICE_COOLDOWN_DAYS,
  NOTICE_MAX_RECIPIENTS,
  NOTICE_REASONS,
  assessAccountSecurity,
  isEligibleFor,
  noticeEventType,
  type AccountSecurity,
  type NoticeReason,
} from './account-security';

export type AdminNoticeView = { reason: NoticeReason; at: Date };

export type AdminUserView = {
  id: string;
  email: string;
  role: 'user' | 'admin';
  isDemoAccount: boolean;
  createdAt: Date;
  security: AccountSecurity;
  /** Dernière relance envoyée pendant la période de délai, s'il y en a une. */
  lastNotice: AdminNoticeView | null;
};

export type NoticeSkipReason =
  | 'not_found'
  | 'not_eligible'
  | 'cooldown'
  | 'send_failed';

export type SendNoticesResult = {
  reason: NoticeReason;
  sent: { id: string; email: string }[];
  skipped: { id: string; email: string | null; why: NoticeSkipReason }[];
};

export type NoticeSummary = Record<
  NoticeReason,
  { eligible: number; onCooldown: number }
>;

const cooldownStart = (): Date =>
  new Date(Date.now() - NOTICE_COOLDOWN_DAYS * 86_400_000);

const reasonOf = (eventType: string): NoticeReason | null => {
  const reason = eventType.replace(/^admin_notice_/, '');
  return (NOTICE_REASONS as readonly string[]).includes(reason)
    ? (reason as NoticeReason)
    : null;
};

const securityOf = (row: AdminUserRow): AccountSecurity =>
  assessAccountSecurity(row);

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly admin: AdminRepository,
    @Inject(MAILER) private readonly mailer: Mailer,
  ) {}

  async listUsers(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: AdminUserView[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.admin.listUsers(opts),
      this.admin.countAll(opts.search),
    ]);
    const notices = await this.admin.noticesSince(
      rows.map((r) => r.id),
      cooldownStart(),
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role === 'admin' ? 'admin' : 'user',
        isDemoAccount: row.isDemoAccount,
        createdAt: row.createdAt,
        security: securityOf(row),
        lastNotice: latestNotice(notices, row.id),
      })),
      total,
    };
  }

  /** Par motif : combien de comptes sont concernés, et combien sont encore dans le délai. */
  async noticeSummary(): Promise<NoticeSummary> {
    const rows = await this.admin.listForNotice();
    const notices = await this.admin.noticesSince(
      rows.map((r) => r.id),
      cooldownStart(),
    );
    const summary = Object.fromEntries(
      NOTICE_REASONS.map((r) => [r, { eligible: 0, onCooldown: 0 }]),
    ) as NoticeSummary;
    for (const row of rows) {
      const security = securityOf(row);
      for (const reason of NOTICE_REASONS) {
        if (!isEligibleFor(security, reason)) continue;
        summary[reason].eligible++;
        if (wasNoticed(notices, row.id, reason)) summary[reason].onCooldown++;
      }
    }
    return summary;
  }

  /**
   * Envoie la relance `reason` aux comptes demandés (`userIds`) ou, sans liste, à tous les comptes
   * concernés. L'éligibilité est toujours recalculée ici : le client ne décide pas qui reçoit quoi.
   */
  async sendNotices(
    reason: NoticeReason,
    userIds: string[] | undefined,
    adminId: string,
  ): Promise<SendNoticesResult> {
    const rows = await this.admin.listForNotice(userIds);
    const notices = await this.admin.noticesSince(
      rows.map((r) => r.id),
      cooldownStart(),
    );
    const result: SendNoticesResult = { reason, sent: [], skipped: [] };

    const found = new Set(rows.map((r) => r.id));
    for (const id of userIds ?? []) {
      if (!found.has(id))
        result.skipped.push({ id, email: null, why: 'not_found' });
    }

    for (const row of rows) {
      const target = { id: row.id, email: row.email };
      if (!isEligibleFor(securityOf(row), reason)) {
        // Envoi groupé : les comptes non concernés ne sont pas des « refus », on les passe en silence.
        if (userIds) result.skipped.push({ ...target, why: 'not_eligible' });
        continue;
      }
      if (wasNoticed(notices, row.id, reason)) {
        result.skipped.push({ ...target, why: 'cooldown' });
        continue;
      }
      if (result.sent.length >= NOTICE_MAX_RECIPIENTS) break;
      try {
        await this.mailer.sendSecurityNotice(row.email, reason);
      } catch (err) {
        this.logger.warn(
          `Relance ${reason} non envoyée à ${row.id} : ${err instanceof Error ? err.message : String(err)}`,
        );
        result.skipped.push({ ...target, why: 'send_failed' });
        continue;
      }
      // Trace d'abord (elle porte le délai anti-relance), déconnexion ensuite : le mail explique
      // pourquoi la session a été fermée, il ne doit donc jamais partir après elle.
      await this.admin.recordNotice(row.id, noticeEventType(reason));
      if (reason === 'reconnect') await this.admin.bumpSessionVersion(row.id);
      result.sent.push(target);
    }

    this.logger.log(
      `Relances ${reason} par ${adminId} : ${result.sent.length} envoyée(s), ${result.skipped.length} ignorée(s)`,
    );
    return result;
  }
}

function latestNotice(
  notices: AdminNoticeRow[],
  userId: string,
): AdminNoticeView | null {
  for (const n of notices) {
    if (n.userId !== userId) continue;
    const reason = reasonOf(n.type);
    if (reason) return { reason, at: n.at };
  }
  return null;
}

function wasNoticed(
  notices: AdminNoticeRow[],
  userId: string,
  reason: NoticeReason,
): boolean {
  const type = noticeEventType(reason);
  return notices.some((n) => n.userId === userId && n.type === type);
}
