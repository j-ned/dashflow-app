import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, desc, eq, lt } from 'drizzle-orm';
import type { Request } from 'express';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.constants';
import { securityEvents, users, type SecurityEventType } from '../db/schema';

export type SecurityEventRow = {
  id: string;
  type: string;
  ip: string | null;
  userAgent: string | null;
  at: Date;
};

const RETENTION_DAYS = 180;
const LIST_MAX = 100;

/** IP et User-Agent du client, bornés pour la colonne (et pour ne pas stocker un roman). */
export function clientContext(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip?.slice(0, 64) ?? null,
    userAgent: typeof ua === 'string' ? ua.slice(0, 255) : null,
  };
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Ne lève jamais : un journal en panne ne doit pas bloquer une connexion. */
  async record(
    type: SecurityEventType,
    userId: string,
    req: Request,
  ): Promise<void> {
    try {
      await this.db
        .insert(securityEvents)
        .values({ userId, type, ...clientContext(req) });
    } catch (err) {
      this.logger.warn(
        `Événement ${type} non journalisé : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Variante quand seul l'e-mail est connu (échec de login, reset) : comptes existants seulement. */
  async recordForEmail(
    type: SecurityEventType,
    email: unknown,
    req: Request,
  ): Promise<void> {
    if (typeof email !== 'string' || !email) return;
    try {
      const [u] = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email.toLowerCase().trim()))
        .limit(1);
      if (u) await this.record(type, u.id, req);
    } catch (err) {
      this.logger.warn(
        `Événement ${type} non journalisé : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  listFor(userId: string, limit = 50): Promise<SecurityEventRow[]> {
    return this.db
      .select({
        id: securityEvents.id,
        type: securityEvents.type,
        ip: securityEvents.ip,
        userAgent: securityEvents.userAgent,
        at: securityEvents.at,
      })
      .from(securityEvents)
      .where(eq(securityEvents.userId, userId))
      .orderBy(desc(securityEvents.at), desc(securityEvents.id))
      .limit(Math.min(Math.max(limit, 1), LIST_MAX));
  }

  /** Rétention bornée : l'historique de connexion est utile quelques mois, pas des années. */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeOld(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
    try {
      await this.db
        .delete(securityEvents)
        .where(and(lt(securityEvents.at, cutoff)));
    } catch (err) {
      this.logger.error(
        'Purge des événements de sécurité échouée',
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
