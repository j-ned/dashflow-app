import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users } from '../../db/schema';
import type { Env } from '../../config/env.schema';

// Ordre de suppression : enfants avant parents (FK). Tables scopées par user_id.
const DELETE_USER_ORDER = [
  'reminders', 'account_transactions', 'recurring_entries', 'consumables', 'documents',
  'medications', 'prescriptions', 'salary_archives', 'loans', 'envelopes', 'appointments',
  'bank_accounts', 'practitioners', 'patients', 'shared_access',
] as const;

// Ordre de restauration : parents avant enfants (FK). Inclut les tables enfants sans user_id.
// account_transactions après bank_accounts (account_id) + patients (member_id) + recurring_entries.
const INSERT_ORDER = [
  'shared_access', 'patients', 'practitioners', 'bank_accounts', 'appointments',
  'envelopes', 'loans', 'salary_archives', 'prescriptions', 'medications',
  'documents', 'consumables', 'recurring_entries', 'account_transactions', 'reminders',
  'envelope_transactions', 'loan_transactions',
] as const;

// Tables dont le snapshot doit être re-pointé vers le compte démo courant avant restauration :
// toutes celles scopées par user_id. (envelope_transactions / loan_transactions n'ont pas de
// user_id — elles référencent leur parent par id, conservé tel quel dans le snapshot.)
const USER_SCOPED: ReadonlySet<string> = new Set(DELETE_USER_ORDER);

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);
  private readonly demoEnabled: boolean;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    config: ConfigService<Env, true>,
  ) {
    this.demoEnabled = config.get('DEMO_ENABLED', { infer: true });
  }

  // Réinitialise toutes les données du compte démo à partir des snapshots demo_seed_*.
  // callerId (optionnel) : si fourni, doit être le compte démo lui-même (déclenchement manuel).
  // Omis pour le déclenchement automatique (cron).
  async reset(callerId?: string): Promise<void> {
    const demo = await this.db.select({ id: users.id }).from(users)
      .where(eq(users.isDemoAccount, true)).limit(1).then((r) => r[0]);
    if (!demo) throw new NotFoundException('Compte démo indisponible');
    if (callerId !== undefined && demo.id !== callerId) {
      throw new ForbiddenException('Réinitialisation réservée au compte démo');
    }
    const id = demo.id;

    await this.db.transaction(async (tx) => {
      // 0. Garde-fou : si un snapshot manque, on ABORTE AVANT toute purge — sinon on viderait le
      //    démo sans pouvoir le restaurer. (Cause de l'incident initial : aucune table demo_seed_*
      //    n'existait → le snapshot est généré par scripts/demo-seed-snapshot.sql.)
      const missing: string[] = [];
      for (const table of INSERT_ORDER) {
        const seed = `demo_seed_${table}`;
        const reg = await tx.execute(sql`select to_regclass(${`public.${seed}`}) as reg`);
        if (!reg[0]?.reg) missing.push(seed);
      }
      if (missing.length > 0) {
        throw new Error(
          `Réinit démo annulée — snapshots manquants : ${missing.join(', ')}. Rejouer scripts/demo-seed-snapshot.sql.`,
        );
      }
      // 1. Purge — enfants sans user_id d'abord (scopés via leur parent), puis tables user_id.
      await tx.execute(sql`delete from loan_transactions where loan_id in (select id from loans where user_id = ${id})`);
      await tx.execute(sql`delete from envelope_transactions where envelope_id in (select id from envelopes where user_id = ${id})`);
      for (const table of DELETE_USER_ORDER) {
        await tx.execute(sql`delete from ${sql.identifier(table)} where user_id = ${id}`);
      }
      // 2. Restauration depuis les snapshots (parents avant enfants). Chaque snapshot user-scopé
      //    est re-pointé vers le compte démo courant : immunise contre une recréation du compte
      //    démo (les user_id du snapshot deviendraient orphelins → violation FK à l'insert).
      for (const table of INSERT_ORDER) {
        const seed = `demo_seed_${table}`;
        if (USER_SCOPED.has(table)) {
          await tx.execute(sql`update ${sql.identifier(seed)} set user_id = ${id}`);
        }
        await tx.execute(sql`insert into ${sql.identifier(table)} select * from ${sql.identifier(seed)}`);
      }
    });
  }

  // Réinitialisation automatique toutes les 6h (no-op si DEMO_ENABLED=false).
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledReset(): Promise<void> {
    if (!this.demoEnabled) return;
    try {
      await this.reset();
      this.logger.log('Compte démo réinitialisé (cron 6h)');
    } catch (err) {
      this.logger.error('Échec de la réinitialisation auto du démo', err instanceof Error ? err.stack : String(err));
      this.logPostgresCause(err);
    }
  }

  // Drizzle encapsule l'erreur postgres-js (« Failed query: … ») et masque le code/détail SQL.
  // On les remonte explicitement pour rendre tout échec futur diagnosticable.
  private logPostgresCause(err: unknown): void {
    const cause = (err as { cause?: { code?: string; detail?: string; constraint_name?: string; message?: string } })?.cause;
    if (cause) {
      this.logger.error(
        `Cause Postgres → code=${cause.code ?? '?'} contrainte=${cause.constraint_name ?? '?'} detail=${cause.detail ?? cause.message ?? '?'}`,
      );
    }
  }
}
