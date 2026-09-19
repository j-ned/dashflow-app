import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gte, ilike, inArray, like, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { securityEvents, users } from '../../db/schema';

/** Échappe les jokers ILIKE pour qu'une recherche « 50% » cherche bien « 50% ». */
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, '\\$&');

export type AdminUserRow = {
  id: string;
  email: string;
  role: string;
  isDemoAccount: boolean;
  createdAt: Date;
  hasPassword: boolean;
  authVersion: number;
  encryptionVersion: number;
  hasRecoveryKey: boolean;
  totpEnabled: boolean;
};

export type AdminNoticeRow = { userId: string; type: string; at: Date };

/** Colonnes techniques suffisantes pour évaluer la sécurité d'un compte — aucun secret n'en sort. */
const USER_COLUMNS = {
  id: users.id,
  email: users.email,
  role: users.role,
  isDemoAccount: users.isDemoAccount,
  createdAt: users.createdAt,
  hasPassword: sql<boolean>`${users.password} is not null`,
  authVersion: users.authVersion,
  encryptionVersion: users.encryptionVersion,
  hasRecoveryKey: sql<boolean>`${users.recoveryWrappedKey} is not null`,
  totpEnabled: sql<boolean>`${users.totpEnabled} is not null`,
};

@Injectable()
export class AdminRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listUsers(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<AdminUserRow[]> {
    const where = opts.search
      ? ilike(users.email, `%${escapeLike(opts.search)}%`)
      : undefined;
    return this.db
      .select(USER_COLUMNS)
      .from(users)
      .where(where)
      .orderBy(sql`${users.createdAt} desc`)
      .limit(opts.limit)
      .offset(opts.offset);
  }

  async countAll(search?: string): Promise<number> {
    const where = search
      ? ilike(users.email, `%${escapeLike(search)}%`)
      : undefined;
    const rows = await this.db
      .select({ value: count() })
      .from(users)
      .where(where);
    return Number(rows[0]?.value ?? 0);
  }

  /** Tous les comptes réels (hors démo), ou seulement ceux demandés. Borné par l'appelant. */
  async listForNotice(userIds?: string[]): Promise<AdminUserRow[]> {
    const where = userIds
      ? and(eq(users.isDemoAccount, false), inArray(users.id, userIds))
      : eq(users.isDemoAccount, false);
    return this.db.select(USER_COLUMNS).from(users).where(where);
  }

  /** Relances d'administration envoyées à ces comptes depuis `since`, la plus récente d'abord. */
  async noticesSince(
    userIds: string[],
    since: Date,
  ): Promise<AdminNoticeRow[]> {
    if (userIds.length === 0) return [];
    return this.db
      .select({
        userId: securityEvents.userId,
        type: securityEvents.type,
        at: securityEvents.at,
      })
      .from(securityEvents)
      .where(
        and(
          inArray(securityEvents.userId, userIds),
          like(securityEvents.type, 'admin\\_notice\\_%'),
          gte(securityEvents.at, since),
        ),
      )
      .orderBy(sql`${securityEvents.at} desc`);
  }

  async recordNotice(userId: string, type: string): Promise<void> {
    // Pas d'IP ni de user-agent : ce sont ceux de l'administrateur, pas ceux du titulaire du compte.
    await this.db.insert(securityEvents).values({ userId, type });
  }

  /** Invalide les sessions ouvertes : le compte devra se reconnecter (même mécanisme que le logout). */
  async bumpSessionVersion(userId: string): Promise<void> {
    await this.db
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, userId));
  }
}
