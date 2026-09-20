import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { users } from '../../db/schema';
import type { Env } from '../../config/env.schema';
import { APP_TIMEZONE, today } from '../../common/today';
import {
  DAY_SHIFTED,
  MONTH_SHIFTED,
  demoShift,
  previousMonth,
  type DateColumns,
} from './demo-rebase';

// Ordre de suppression : enfants avant parents (FK). Tables scopées par user_id.
const DELETE_USER_ORDER = [
  'reminders',
  'account_transactions',
  'recurring_entries',
  'documents',
  'medications',
  'prescriptions',
  'salary_archives',
  'loans',
  'envelopes',
  'appointments',
  'bank_accounts',
  'practitioners',
  'patients',
] as const;

// Ordre de restauration : parents avant enfants (FK). Inclut les tables enfants sans user_id.
// account_transactions après bank_accounts (account_id) + patients (member_id) + recurring_entries.
const INSERT_ORDER = [
  'patients',
  'practitioners',
  'bank_accounts',
  'appointments',
  'envelopes',
  'loans',
  'salary_archives',
  'prescriptions',
  'medications',
  'documents',
  'recurring_entries',
  'account_transactions',
  'reminders',
  'envelope_transactions',
  'loan_transactions',
] as const;

// Tables dont le snapshot doit être re-pointé vers le compte démo courant avant restauration :
// toutes celles scopées par user_id. (envelope_transactions / loan_transactions n'ont pas de
// user_id — elles référencent leur parent par id, conservé tel quel dans le snapshot.)
const USER_SCOPED: ReadonlySet<string> = new Set(DELETE_USER_ORDER);

// Clé arbitraire mais fixe du verrou consultatif Postgres de la réinitialisation démo.
const DEMO_RESET_LOCK_KEY = 8_213_047;

type DemoTx = Parameters<Parameters<DrizzleDB['transaction']>[0]>[0];

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
    const demo = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isDemoAccount, true))
      .limit(1)
      .then((r) => r[0]);
    if (!demo) throw new NotFoundException('Compte démo indisponible');
    if (callerId !== undefined && demo.id !== callerId) {
      throw new ForbiddenException('Réinitialisation réservée au compte démo');
    }
    const id = demo.id;

    await this.db.transaction(async (tx) => {
      // Verrou consultatif (libéré en fin de transaction) : deux instances du backend, ou le cron
      // et un reset manuel, ne peuvent pas rejouer la purge/restauration en parallèle.
      const [lock] = await tx.execute<{ locked: boolean }>(
        sql`select pg_try_advisory_xact_lock(${DEMO_RESET_LOCK_KEY}) as locked`,
      );
      if (!lock?.locked) {
        this.logger.warn(
          'Réinit démo ignorée : une autre réinitialisation est en cours',
        );
        return;
      }
      // 0. Garde-fou : si un snapshot manque, on ABORTE AVANT toute purge — sinon on viderait le
      //    démo sans pouvoir le restaurer. (Cause de l'incident initial : aucune table demo_seed_*
      //    n'existait → le snapshot est généré par scripts/demo-seed-snapshot.sql.)
      const missing: string[] = [];
      for (const table of INSERT_ORDER) {
        const seed = `demo_seed_${table}`;
        const reg = await tx.execute(
          sql`select to_regclass(${`public.${seed}`}) as reg`,
        );
        if (!reg[0]?.reg) missing.push(seed);
      }
      if (missing.length > 0) {
        throw new Error(
          `Réinit démo annulée — snapshots manquants : ${missing.join(', ')}. Rejouer scripts/demo-seed-snapshot.sql.`,
        );
      }
      // 1. Purge — enfants sans user_id d'abord (scopés via leur parent), puis tables user_id.
      await tx.execute(
        sql`delete from loan_transactions where loan_id in (select id from loans where user_id = ${id})`,
      );
      await tx.execute(
        sql`delete from envelope_transactions where envelope_id in (select id from envelopes where user_id = ${id})`,
      );
      for (const table of DELETE_USER_ORDER) {
        await tx.execute(
          sql`delete from ${sql.identifier(table)} where user_id = ${id}`,
        );
      }
      // 2. Restauration depuis les snapshots (parents avant enfants). Chaque snapshot user-scopé
      //    est re-pointé vers le compte démo courant : immunise contre une recréation du compte
      //    démo (les user_id du snapshot deviendraient orphelins → violation FK à l'insert).
      // 1b. La ligne users elle-même : un visiteur a pu activer E2EE (démo illisible pour tous),
      //     poser un avatar ou un 2FA avant l'introduction de DemoAccountGuard.
      await tx.execute(
        sql`update users set encryption_version = 0, encryption_salt = null, wrapped_master_key = null, recovery_wrapped_key = null, encryption_passphrase = false, totp_secret = null, totp_enabled = null, avatar_url = null, password = null where id = ${id}`,
      );
      for (const table of INSERT_ORDER) {
        const seed = `demo_seed_${table}`;
        if (USER_SCOPED.has(table)) {
          await tx.execute(
            sql`update ${sql.identifier(seed)} set user_id = ${id}`,
          );
        }
        // Colonnes nommées (intersection table ↔ snapshot) : `insert … select *` dépendait de
        // l'ordre des colonnes, et la première migration ajoutant une colonne cassait le reset.
        const columns = await tx.execute<{ column_name: string }>(
          sql`select t.column_name from information_schema.columns t
              join information_schema.columns s
                on s.column_name = t.column_name and s.table_schema = 'public' and s.table_name = ${seed}
              where t.table_schema = 'public' and t.table_name = ${table}
              order by t.ordinal_position`,
        );
        const cols = sql.join(
          columns.map((c) => sql.identifier(c.column_name)),
          sql`, `,
        );
        await tx.execute(
          sql`insert into ${sql.identifier(table)} (${cols}) select ${cols} from ${sql.identifier(seed)}`,
        );
      }
      // 3. Recalage temporel : la date de capture du snapshot devient « aujourd'hui ».
      await this.rebaseDates(tx, id);
    });
  }

  // Date de capture du snapshot : `demo_seed_meta.reference_date` (écrite par
  // scripts/demo-seed-snapshot.sql), sinon la création la plus récente parmi les snapshots
  // (snapshots antérieurs à cette table).
  private async seedReference(tx: DemoTx): Promise<string | null> {
    const meta = await tx.execute(
      sql`select to_regclass('public.demo_seed_meta') as reg`,
    );
    if (meta[0]?.reg) {
      const rows = await tx.execute<{ ref: string | null }>(
        sql`select to_char(max(reference_date), 'YYYY-MM-DD') as ref from demo_seed_meta`,
      );
      if (rows[0]?.ref) return rows[0].ref;
    }
    let reference: string | null = null;
    for (const table of INSERT_ORDER) {
      const seed = `demo_seed_${table}`;
      const has = await tx.execute(
        sql`select 1 from information_schema.columns where table_schema = 'public' and table_name = ${seed} and column_name = 'created_at'`,
      );
      if (has.length === 0) continue;
      const rows = await tx.execute<{ ref: string | null }>(
        sql`select to_char(max(created_at) at time zone ${APP_TIMEZONE}, 'YYYY-MM-DD') as ref from ${sql.identifier(seed)}`,
      );
      const ref = rows[0]?.ref;
      if (ref && (reference === null || ref > reference)) reference = ref;
    }
    return reference;
  }

  private async rebaseDates(tx: DemoTx, userId: string): Promise<void> {
    const reference = await this.seedReference(tx);
    if (!reference) return;
    const now = today();
    const shift = demoShift(reference, now);

    const scope = (t: DateColumns) =>
      t.parent
        ? sql`${sql.identifier(t.parent.key)} in (select id from ${sql.identifier(t.parent.table)} where user_id = ${userId})`
        : sql`user_id = ${userId}`;
    const shiftAll = async (
      tables: readonly DateColumns[],
      interval: ReturnType<typeof sql>,
    ) => {
      for (const t of tables) {
        const sets = sql.join(
          t.columns.map(
            (c) =>
              sql`${sql.identifier(c)} = (${sql.identifier(c)} + ${interval})::date`,
          ),
          sql`, `,
        );
        await tx.execute(
          sql`update ${sql.identifier(t.table)} set ${sets} where ${scope(t)}`,
        );
      }
    };
    if (shift.days > 0) {
      await shiftAll(DAY_SHIFTED, sql`make_interval(days => ${shift.days})`);
    }
    if (shift.months > 0) {
      await shiftAll(
        MONTH_SHIFTED,
        sql`make_interval(months => ${shift.months})`,
      );
      await tx.execute(
        sql`update salary_archives
            set month = to_char(to_date(month || '-01', 'YYYY-MM-DD') + make_interval(months => ${shift.months}), 'YYYY-MM')
            where user_id = ${userId} and month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
      );
    }
    // Pas de consultation le dimanche, quel que soit le jeu capturé : report au lundi.
    await tx.execute(
      sql`update appointments set date = date + 1
          where user_id = ${userId} and extract(dow from date) = 0`,
    );
    // Libellés millésimés (« Vacances été 2026 ») : l'année suit le recalage.
    const years = Number(now.slice(0, 4)) - Number(reference.slice(0, 4));
    if (years > 0) {
      const from = reference.slice(0, 4);
      const to = now.slice(0, 4);
      await tx.execute(
        sql`update envelopes set name = replace(name, ${from}, ${to}) where user_id = ${userId}`,
      );
      await tx.execute(
        sql`update recurring_entries set label = replace(label, ${from}, ${to})
            where user_id = ${userId} and encrypted_data is null`,
      );
    }
    // Le recalage par semaines entières peut laisser un rendez-vous « planifié » quelques jours
    // dans le passé : il a eu lieu.
    await tx.execute(
      sql`update appointments set status = 'completed'
          where user_id = ${userId} and status = 'scheduled' and date < ${now}::date`,
    );
    await this.postPreviousMonth(tx, userId, now);
  }

  // Le dernier mois clos n'a pas d'archive de paie (elle se saisit le mois suivant) : on y pose
  // les opérations réelles des échéances mensuelles, comme l'aurait fait le pointage. Le Relevé,
  // le solde confirmé et l'historique calculé ont ainsi de quoi s'afficher. Idempotent.
  private async postPreviousMonth(
    tx: DemoTx,
    userId: string,
    now: string,
  ): Promise<void> {
    const first = `${previousMonth(now)}-01`;
    await tx.execute(
      sql`insert into account_transactions
            (user_id, account_id, amount, direction, to_account_id, date, category, member_id, recurring_entry_id, created_at)
          select r.user_id, r.account_id, r.amount,
                 (case r.type when 'income' then 'income' when 'transfer' then 'transfer' else 'expense' end)::transaction_direction,
                 r.to_account_id, d.day, r.category, r.member_id, r.id, d.day + time '12:00'
          from recurring_entries r
          cross join lateral (
            select (${first}::date + (least(r.day_of_month, extract(day from (${first}::date + interval '1 month - 1 day'))::int) - 1))::date as day
          ) d
          where r.user_id = ${userId}
            and r.encrypted_data is null
            and r.account_id is not null
            and r.day_of_month is not null
            and r.type in ('income', 'expense', 'spending', 'transfer')
            and (r.end_date is null or r.end_date >= ${first}::date)
            and not exists (
              select 1 from account_transactions t
              where t.recurring_entry_id = r.id
                and t.date >= ${first}::date
                and t.date < ${first}::date + interval '1 month'
            )`,
    );
  }

  // Réinitialisation automatique toutes les 6h (no-op si DEMO_ENABLED=false).
  @Cron(CronExpression.EVERY_6_HOURS)
  async scheduledReset(): Promise<void> {
    if (!this.demoEnabled) return;
    try {
      await this.reset();
      this.logger.log('Compte démo réinitialisé (cron 6h)');
    } catch (err) {
      this.logger.error(
        'Échec de la réinitialisation auto du démo',
        err instanceof Error ? err.stack : String(err),
      );
      this.logPostgresCause(err);
    }
  }

  // Drizzle encapsule l'erreur postgres-js (« Failed query: … ») et masque le code/détail SQL.
  // On les remonte explicitement pour rendre tout échec futur diagnosticable.
  private logPostgresCause(err: unknown): void {
    const cause = (
      err as {
        cause?: {
          code?: string;
          detail?: string;
          constraint_name?: string;
          message?: string;
        };
      }
    )?.cause;
    if (cause) {
      this.logger.error(
        `Cause Postgres → code=${cause.code ?? '?'} contrainte=${cause.constraint_name ?? '?'} detail=${cause.detail ?? cause.message ?? '?'}`,
      );
    }
  }
}
