import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import type { DrizzleDB } from '../db/drizzle.constants';
import { redisRestConfig, type Env } from '../config/env.schema';
import type { Mailer } from '../mail/mailer';
import { ConsoleMailer } from '../mail/console.mailer';
import { SmtpMailer } from '../mail/smtp.mailer';
import { StorageService } from '../storage/storage.service';
import { TokenService } from '../auth/token.service';
import { CsrfService } from '../auth/csrf.service';
import { CsrfPolicy } from '../auth/csrf-policy';
import { RoleChecker } from '../auth/role-checker';
import { SessionAuthenticator } from '../auth/session-authenticator';
import { AuthRepository } from '../auth/auth.repository';
import { AuthService } from '../auth/auth.service';
import { EncryptionService } from '../auth/encryption.service';
import { OAuthService } from '../auth/oauth.service';
import { SecretCipherService } from '../auth/secret-cipher.service';
import { TwoFactorService } from '../auth/two-factor.service';
import { UploadPolicy } from '../common/files/upload-policy';
import { SecurityEventsService } from '../security-events/security-events.service';
import { DemoService } from '../modules/demo/demo.service';
import { AdminRepository } from '../modules/admin/admin.repository';
import { AdminService } from '../modules/admin/admin.service';
import { AccountTransactionsService } from '../modules/account-transactions/account-transactions.service';
import { AppointmentsService } from '../modules/appointments/appointments.service';
import { BankAccountsService } from '../modules/bank-accounts/bank-accounts.service';
import { DocumentsService } from '../modules/documents/documents.service';
import { EnvelopesService } from '../modules/envelopes/envelopes.service';
import { LoansService } from '../modules/loans/loans.service';
import { MedicationsService } from '../modules/medications/medications.service';
import { MembersService } from '../modules/members/members.service';
import { PatientsService } from '../modules/patients/patients.service';
import { PractitionersService } from '../modules/practitioners/practitioners.service';
import { PrescriptionsService } from '../modules/prescriptions/prescriptions.service';
import { RecurringEntriesService } from '../modules/recurring-entries/recurring-entries.service';
import { RemindersService } from '../modules/reminders/reminders.service';
import { SalaryArchivesService } from '../modules/salary-archives/salary-archives.service';
import { RateLimitStore, type RateLimiter } from './rate-limit-store';
import { RedisRateLimitStore } from './redis-rate-limit-store';
import { SessionCookies } from './kit';

/** Tout ce dont la couche HTTP Hono a besoin, construit une fois au démarrage. */
export type HttpDeps = ReturnType<typeof buildDeps>;

function buildDeps(
  env: Env,
  db: DrizzleDB,
  mailer: Mailer,
  rateLimits: RateLimiter = new RateLimitStore(),
) {
  const tokens = new TokenService(env);
  const csrf = new CsrfService(env);
  const storage = new StorageService(env);
  const authRepo = new AuthRepository(db);
  const adminRepo = new AdminRepository(db);
  return {
    env,
    db,
    mailer,
    storage,
    tokens,
    csrf,
    sessions: new SessionAuthenticator(tokens, db),
    sessionCookies: new SessionCookies(
      tokens,
      csrf,
      env.NODE_ENV === 'production',
    ),
    csrfPolicy: new CsrfPolicy(csrf, env),
    roles: new RoleChecker(db),
    rateLimits,
    uploadPolicy: new UploadPolicy(authRepo),
    securityEvents: new SecurityEventsService(db),
    auth: new AuthService(
      authRepo,
      mailer,
      new TwoFactorService(),
      storage,
      new SecretCipherService(env),
    ),
    encryption: new EncryptionService(authRepo, db),
    oauth: new OAuthService(env, authRepo),
    demo: new DemoService(db, env),
    admin: new AdminService(adminRepo, mailer),
    accountTransactions: new AccountTransactionsService(db),
    appointments: new AppointmentsService(db),
    bankAccounts: new BankAccountsService(db),
    documents: new DocumentsService(db, storage),
    envelopes: new EnvelopesService(db),
    loans: new LoansService(db),
    medications: new MedicationsService(db),
    members: new MembersService(db, storage),
    patients: new PatientsService(db, storage),
    practitioners: new PractitionersService(db),
    prescriptions: new PrescriptionsService(db, storage),
    recurringEntries: new RecurringEntriesService(db, storage),
    reminders: new RemindersService(db),
    salaryArchives: new SalaryArchivesService(db, storage),
  };
}

/** Racine de composition : remplace l'injection de dépendances de Nest (même câblage). */
export function createDeps(env: Env): {
  deps: HttpDeps;
  close: () => Promise<void>;
} {
  const onVercel = env.VERCEL === '1';
  // Sur Vercel : peu de connexions par instance (elles se multiplient avec les instances) et pas
  // de requêtes préparées, que le pooler de Neon/PgBouncer en mode transaction ne garantit pas.
  const client = postgres(
    env.DATABASE_URL,
    onVercel ? { max: 3, prepare: false, idle_timeout: 20 } : {},
  );
  const db = drizzle(client, { schema });
  const mailer: Mailer =
    env.MAILER === 'smtp' ? new SmtpMailer(env) : new ConsoleMailer(env);
  const redis = redisRestConfig(env);
  const deps = buildDeps(
    env,
    db,
    mailer,
    redis ? new RedisRateLimitStore(redis) : new RateLimitStore(),
  );
  return {
    deps,
    close: async () => {
      deps.rateLimits.dispose();
      // Rend les connexions à Postgres au lieu de les laisser tomber à la mort du processus.
      await client.end({ timeout: 5 });
    },
  };
}

/** Pour les tests : mêmes dépendances, base et mailer fournis. */
export const createDepsWith = buildDeps;
