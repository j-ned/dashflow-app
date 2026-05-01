# Demo Account Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, shared, pre-populated demo account (`demo@dashflow.app`) reachable via a one-click "Démo live" button on the landing, gated by `DEMO_ENABLED`, with a deterministic seed of ~100 entities and a 6h cron reset.

**Architecture:** Backend adds an `is_demo_account` flag on `users`, two new auth routes (`/auth/demo-login`, `/auth/demo-reset`), a deterministic seed script (`backend/src/scripts/seed-demo/`), and an internal `node-cron` that runs the seed every 6h. Frontend adds `AuthStore.demoLogin()`, bypasses `needsEncryptionSetup`/`needsUnlock` when `isDemoAccount=true`, wires the landing CTA, and shows a demo banner in app-shell.

**Tech Stack:** Hono, Drizzle ORM, Postgres (backend) · Angular 21, Vitest, Transloco (frontend) · `node-cron` (new dep).

**Spec:** `docs/superpowers/specs/2026-05-01-demo-account-design.md`

---

## File Structure

**Backend — new files:**
- `backend/src/scripts/seed-demo.ts` — CLI entrypoint
- `backend/src/scripts/seed-demo/rng.ts` — mulberry32 seeded RNG
- `backend/src/scripts/seed-demo/fixtures.ts` — constants (names, addresses, reasons)
- `backend/src/scripts/seed-demo/builders/family.ts` — patients
- `backend/src/scripts/seed-demo/builders/budget.ts` — accounts, envelopes, recurring, loans, archives
- `backend/src/scripts/seed-demo/builders/medical.ts` — practitioners, appointments, medications, prescriptions, documents, reminders
- `backend/src/scripts/seed-demo/index.ts` — `runDemoReset`, `ensureDemoUser`, `wipeDemoData`
- `backend/src/cron/demo-reset.ts` — `startDemoResetCron`
- `backend/drizzle/0001_demo_account.sql` — generated migration

**Backend — modified files:**
- `backend/src/db/schema.ts` — add `isDemoAccount` field
- `backend/src/routes/auth.routes.ts` — add `/demo-login`, `/demo-reset`, block demo email in `/register`, expose `isDemoAccount` in `toPublicUser`
- `backend/src/index.ts` — wire `startDemoResetCron()`
- `backend/package.json` — add `node-cron` dep + scripts
- `backend/.env.example` — document `DEMO_ENABLED`

**Frontend — new files:**
- `src/app/layout/components/demo-banner/demo-banner.ts` — banner component
- `src/app/features/auth/domain/auth.store.spec.ts` — regression test for demo bypass

**Frontend — modified files:**
- `src/app/features/auth/domain/auth.store.ts` — `isDemoAccount` field, `demoLogin()` method, bypass `needsEncryptionSetup` and `needsUnlock`
- `src/app/pages/landing/landing.ts` — replace `DEMO_URL` constant with handler
- `src/app/layout/app-shell/app-shell.ts` (or equivalent) — embed `<app-demo-banner>`
- `src/assets/i18n/fr.json` — `demo.*` keys
- `src/assets/i18n/en.json` — `demo.*` keys

---

## Task 1: DB migration — `users.is_demo_account`

**Files:**
- Modify: `backend/src/db/schema.ts`
- Create: `backend/drizzle/0001_demo_account.sql` (generated)

- [ ] **Step 1: Update schema**

In `backend/src/db/schema.ts`, find the `users` table block and add the new column right after `encryptionPassphrase`:

```ts
export const users = pgTable('users', {
  // ... existing fields up to encryptionPassphrase
  encryptionPassphrase: boolean('encryption_passphrase').notNull().default(false),
  isDemoAccount: boolean('is_demo_account').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 2: Generate migration**

Run: `cd backend && pnpm db:generate`
Expected: a new file `backend/drizzle/0001_*.sql` created with `ALTER TABLE "users" ADD COLUMN "is_demo_account" boolean DEFAULT false NOT NULL;`

- [ ] **Step 3: Add partial index manually**

Edit the generated migration file and append at the end:

```sql
--> statement-breakpoint
CREATE INDEX "users_is_demo_account_idx" ON "users" ("is_demo_account") WHERE "is_demo_account" = true;
```

- [ ] **Step 4: Apply migration**

Run: `cd backend && pnpm db:migrate`
Expected: migration applied, no errors.

- [ ] **Step 5: Verify**

Run: `cd backend && psql "$DATABASE_URL" -c "\d users" | grep is_demo_account`
Expected: line showing `is_demo_account | boolean | not null default false`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle/0001_*.sql
git commit -m "feat(db): add is_demo_account flag on users"
```

---

## Task 2: Backend — auth helpers expose `isDemoAccount`

**Files:**
- Modify: `backend/src/routes/auth.routes.ts:18-29` (the `toPublicUser` function and its type signature)

- [ ] **Step 1: Update `toPublicUser` signature and return**

In `backend/src/routes/auth.routes.ts`, replace the `toPublicUser` function (around line 18) with:

```ts
function toPublicUser(user: { id: string; email: string; password: string | null; displayName: string | null; avatarUrl: string | null; totpEnabled: Date | null; googleId: string | null; encryptionVersion: number; encryptionPassphrase: boolean; encryptionSalt: string | null; wrappedMasterKey: string | null; recoveryWrappedKey: string | null; isDemoAccount: boolean }) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ? `/api/auth/avatar/${user.id}` : null,
    totpEnabled: !!user.totpEnabled,
    hasPassword: !!user.password,
    googleLinked: !!user.googleId,
    encryptionVersion: user.encryptionVersion,
    hasEncryptionPassphrase: user.encryptionPassphrase,
    isDemoAccount: user.isDemoAccount,
  };
}
```

- [ ] **Step 2: Block demo email in `/auth/register`**

Find the `/auth/register` handler (around line 47). Just after the `validate(registerSchema, ...)` block and before the existing email lookup, insert:

```ts
if (email === 'demo@dashflow.app') {
  return c.json({ error: 'Cet email est réservé' }, 409);
}
```

- [ ] **Step 3: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Smoke test register block**

Start backend in dev: `cd backend && pnpm dev` (in another shell).
Run:
```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@dashflow.app","password":"abcdefgh"}'
```
Expected: HTTP 409 with `{"error":"Cet email est réservé"}`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.routes.ts
git commit -m "feat(auth): expose isDemoAccount in public user, block demo email in register"
```

---

## Task 3: Backend — `POST /auth/demo-login`

**Files:**
- Modify: `backend/src/routes/auth.routes.ts`

- [ ] **Step 1: Add the route**

At the bottom of `backend/src/routes/auth.routes.ts`, just before `export default auth;`, add:

```ts
import { rateLimiter } from 'hono-rate-limiter';

// ── Demo Login (no auth, gated by DEMO_ENABLED env) ──
auth.post(
  '/demo-login',
  rateLimiter({
    windowMs: 60_000,
    limit: 10,
    keyGenerator: (c) => c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'anon',
  }),
  async (c) => {
    if (process.env['DEMO_ENABLED'] !== 'true') {
      return c.json({ error: 'Demo désactivée' }, 403);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.isDemoAccount, true))
      .limit(1);

    if (!user) {
      return c.json({ error: 'Compte démo non initialisé' }, 503);
    }

    const token = await signToken({ sub: user.id, email: user.email });
    console.log(`[auth] Demo login from ${c.req.header('x-forwarded-for') ?? 'unknown'}`);

    return c.json({ token, user: toPublicUser(user), keyMaterial: null });
  },
);
```

If `rateLimiter` is already imported at the top of the file, skip the import line. Verify with: `grep -n 'rateLimiter' backend/src/routes/auth.routes.ts` — if the import already exists, only add the route.

- [ ] **Step 2: Smoke test (DEMO_ENABLED=false)**

In a fresh shell:
```bash
cd backend && DEMO_ENABLED=false pnpm dev &
sleep 2
curl -i -X POST http://localhost:3000/api/auth/demo-login
```
Expected: HTTP 403 with `{"error":"Demo désactivée"}`. Kill the backend process.

- [ ] **Step 3: Smoke test (DEMO_ENABLED=true, no demo user yet)**

```bash
cd backend && DEMO_ENABLED=true pnpm dev &
sleep 2
curl -i -X POST http://localhost:3000/api/auth/demo-login
```
Expected: HTTP 503 with `{"error":"Compte démo non initialisé"}`. Kill the backend.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/auth.routes.ts
git commit -m "feat(auth): add POST /auth/demo-login gated by DEMO_ENABLED"
```

---

## Task 4: Seed — RNG utility

**Files:**
- Create: `backend/src/scripts/seed-demo/rng.ts`

- [ ] **Step 1: Write `rng.ts`**

```ts
// backend/src/scripts/seed-demo/rng.ts
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
```

- [ ] **Step 2: Determinism smoke check (inline)**

Run: `cd backend && pnpm tsx -e "import { makeRng } from './src/scripts/seed-demo/rng.ts'; const a = makeRng(42); const b = makeRng(42); console.log([a(), a(), a()].join(',') === [b(), b(), b()].join(',') ? 'OK' : 'FAIL');"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-demo/rng.ts
git commit -m "feat(seed): add deterministic mulberry32 RNG"
```

---

## Task 5: Seed — fixtures

**Files:**
- Create: `backend/src/scripts/seed-demo/fixtures.ts`

- [ ] **Step 1: Write `fixtures.ts`**

```ts
// backend/src/scripts/seed-demo/fixtures.ts

export const FAMILY = [
  { firstName: 'Marie',  lastName: 'Dubois', birthDate: '1987-04-12', color: '#E11D48', notes: 'Allergie pénicilline' },
  { firstName: 'Thomas', lastName: 'Dubois', birthDate: '1985-09-23', color: '#2563EB', notes: '' },
  { firstName: 'Lucas',  lastName: 'Dubois', birthDate: '2017-11-04', color: '#16A34A', notes: 'Asthme léger' },
  { firstName: 'Léa',    lastName: 'Dubois', birthDate: '2013-06-28', color: '#9333EA', notes: '' },
] as const;

export const BANK_ACCOUNTS = [
  { name: 'Compte joint (BNP)',                 initialBalance: '5200.00',  color: '#16A34A', dotColor: '#16A34A' },
  { name: 'Marie - perso (Boursorama)',         initialBalance: '1800.00',  color: '#E11D48', dotColor: '#E11D48' },
  { name: 'Livret A famille (La Banque Postale)', initialBalance: '12400.00', color: '#2563EB', dotColor: '#2563EB' },
] as const;

export const ENVELOPES = [
  { name: 'Vacances été 2026',     type: 'vacances',   balance: '2000.00', target: '3000.00',  color: '#F59E0B', dueDay: 15 },
  { name: 'Impôts foncier',        type: 'impôts',     balance: '800.00',  target: '1200.00',  color: '#DC2626', dueDay: null },
  { name: 'Épargne urgence',       type: 'épargne',    balance: '5000.00', target: '10000.00', color: '#10B981', dueDay: null },
  { name: 'Voiture (révision)',    type: 'équipement', balance: '1500.00', target: '3000.00',  color: '#6366F1', dueDay: null },
  { name: 'Travaux salle de bain', type: 'équipement', balance: '400.00',  target: '2500.00',  color: '#0EA5E9', dueDay: null },
  { name: 'Cadeaux Noël 2026',     type: 'épargne',    balance: '180.00',  target: '500.00',   color: '#EC4899', dueDay: null },
] as const;

// 15 entries — type matches recurring_entry_type enum
export const RECURRING = [
  { label: 'Salaire Thomas',     amount: '2850.00',  type: 'income',         dayOfMonth: 28, accountIdx: 0, memberIdx: 1, category: 'Salaire' },
  { label: 'Salaire Marie',      amount: '2100.00',  type: 'income',         dayOfMonth: 30, accountIdx: 1, memberIdx: 0, category: 'Salaire' },
  { label: 'Loyer',              amount: '-1200.00', type: 'expense',        dayOfMonth: 5,  accountIdx: 0, memberIdx: null, category: 'Logement' },
  { label: 'Courses',            amount: '-650.00',  type: 'expense',        dayOfMonth: 1,  accountIdx: 0, memberIdx: null, category: 'Alimentation' },
  { label: 'EDF',                amount: '-120.00',  type: 'expense',        dayOfMonth: 10, accountIdx: 0, memberIdx: null, category: 'Énergie' },
  { label: 'Internet Free',      amount: '-39.99',   type: 'expense',        dayOfMonth: 12, accountIdx: 0, memberIdx: null, category: 'Télécom' },
  { label: 'Mutuelle famille',   amount: '-180.00',  type: 'expense',        dayOfMonth: 8,  accountIdx: 0, memberIdx: null, category: 'Santé' },
  { label: 'Assurance auto',     amount: '-85.00',   type: 'expense',        dayOfMonth: 15, accountIdx: 0, memberIdx: null, category: 'Transport' },
  { label: 'Cantine Lucas + Léa',amount: '-210.00',  type: 'expense',        dayOfMonth: 5,  accountIdx: 0, memberIdx: null, category: 'École' },
  { label: 'Essence',            amount: '-180.00',  type: 'expense',        dayOfMonth: 20, accountIdx: 0, memberIdx: null, category: 'Transport' },
  { label: 'Taxe foncière',      amount: '-1450.00', type: 'annual_expense', dayOfMonth: null, accountIdx: 0, memberIdx: null, category: 'Impôts' },
  { label: 'Taxe habitation',    amount: '-680.00',  type: 'annual_expense', dayOfMonth: null, accountIdx: 0, memberIdx: null, category: 'Impôts' },
  { label: 'Assurance habitation',amount:'-340.00',  type: 'annual_expense', dayOfMonth: null, accountIdx: 0, memberIdx: null, category: 'Logement' },
  { label: 'Netflix',            amount: '-17.99',   type: 'spending',       dayOfMonth: 18, accountIdx: 0, memberIdx: null, category: 'Loisirs' },
  { label: 'Spotify Famille',    amount: '-17.99',   type: 'spending',       dayOfMonth: 22, accountIdx: 0, memberIdx: null, category: 'Loisirs' },
] as const;

export const PRACTITIONERS = [
  { name: 'Dr Sophie Martin',   type: 'generaliste',     phone: '01 43 55 12 34', address: '12 rue Oberkampf, 75011 Paris' },
  { name: 'Dr Camille Lemoine', type: 'pediatre',        phone: '01 43 55 22 78', address: '34 boulevard Voltaire, 75011 Paris' },
  { name: 'Dr Antoine Roux',    type: 'dentiste',        phone: '01 43 67 88 91', address: '7 avenue Daumesnil, 75012 Paris' },
  { name: 'Dr Clara Bernard',   type: 'ophtalmologue',   phone: '01 43 55 44 12', address: '21 rue de la Roquette, 75011 Paris' },
  { name: 'Mme Julie Dubois',   type: 'kinesitherapeute',phone: '01 43 55 90 11', address: '15 rue Sedaine, 75011 Paris' },
  { name: 'Dr Marc Petit',      type: 'orthodontiste',   phone: '01 43 67 33 22', address: '8 rue de Reuilly, 75012 Paris' },
  { name: 'Dr Léa Garnier',     type: 'dermatologue',    phone: '01 43 55 60 80', address: '50 boulevard Voltaire, 75011 Paris' },
  { name: 'Mme Anne Lefèvre',   type: 'psychologue',     phone: '01 43 55 70 90', address: '3 rue Popincourt, 75011 Paris' },
] as const;

// Reasons by practitioner type — for randomized appointment generation
export const APPOINTMENT_REASONS: Record<string, string[]> = {
  generaliste:      ['Contrôle annuel', 'Renouvellement ordonnance', 'Bilan thyroïde', 'Toux persistante'],
  pediatre:         ['Vaccin DTP rappel', 'Contrôle croissance', 'Otite', 'Bilan annuel'],
  dentiste:         ['Détartrage', 'Carie molaire', 'Contrôle annuel', 'Bridge'],
  ophtalmologue:    ['Renouvellement lunettes', 'Fond d\'œil', 'Contrôle myopie'],
  kinesitherapeute: ['Séance lombaire', 'Rééducation cheville', 'Bilan posture'],
  orthodontiste:    ['Ajustement bagues', 'Bilan ortho', 'Pose contention'],
  dermatologue:     ['Contrôle grains de beauté', 'Eczéma chronique'],
  psychologue:      ['Séance hebdomadaire', 'Bilan anxiété'],
};

export const MEDICATIONS = [
  { name: 'Levothyrox 50µg',       type: 'comprime', dosage: '1 cp/j matin', dailyRate: '1',    quantity: 90, alertDaysBefore: 14, patientIdx: 0, skipDays: [] as number[] },
  { name: 'Doliprane 500mg',       type: 'comprime', dosage: '1 cp si fièvre', dailyRate: '0.5', quantity: 16, alertDaysBefore: 7,  patientIdx: 2, skipDays: [0, 6] },
  { name: 'Vitamine D Zyma',       type: 'gouttes',  dosage: '4 gouttes/j',  dailyRate: '0.5',  quantity: 30, alertDaysBefore: 10, patientIdx: 3, skipDays: [] },
  { name: 'Smecta',                type: 'sirop',    dosage: '1 sachet × 3/j', dailyRate: '3',  quantity: 15, alertDaysBefore: 3,  patientIdx: 2, skipDays: [] },
  { name: 'Crème hydrocortisone',  type: 'creme',    dosage: 'Application × 2/j', dailyRate: '2', quantity: 14, alertDaysBefore: 5, patientIdx: 3, skipDays: [] },
  { name: 'Aspégic 500',           type: 'gelule',   dosage: '1 sachet si maux de tête', dailyRate: '0.3', quantity: 20, alertDaysBefore: 7, patientIdx: 1, skipDays: [] },
] as const;

export const DOCUMENTS = [
  { type: 'compte_rendu', title: 'CR consultation cardiologie',  patientIdx: 1, practitionerIdx: 0 },
  { type: 'compte_rendu', title: 'CR contrôle dentaire',         patientIdx: 0, practitionerIdx: 2 },
  { type: 'compte_rendu', title: 'CR bilan ortho Lucas',         patientIdx: 2, practitionerIdx: 5 },
  { type: 'facture',      title: 'Facture mutuelle Q1 2026',     patientIdx: 0, practitionerIdx: null },
  { type: 'facture',      title: 'Facture mutuelle Q4 2025',     patientIdx: 0, practitionerIdx: null },
  { type: 'bilan',        title: 'Bilan sanguin Marie',          patientIdx: 0, practitionerIdx: 0 },
  { type: 'certificat',   title: 'Certificat sport Lucas',       patientIdx: 2, practitionerIdx: 1 },
  { type: 'courrier',     title: 'Orientation pédiatre→ortho',   patientIdx: 2, practitionerIdx: 1 },
] as const;
```

- [ ] **Step 2: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-demo/fixtures.ts
git commit -m "feat(seed): add demo fixtures (family, accounts, practitioners, meds, docs)"
```

---

## Task 6: Seed — family builder

**Files:**
- Create: `backend/src/scripts/seed-demo/builders/family.ts`

- [ ] **Step 1: Write `family.ts`**

```ts
// backend/src/scripts/seed-demo/builders/family.ts
import type { db } from '@db/client';
import { patients } from '@db/schema';
import { FAMILY } from '../fixtures.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SeededFamily = {
  patients: { id: string; firstName: string; lastName: string; birthDate: string }[];
};

export async function seedFamily(tx: Tx, userId: string): Promise<SeededFamily> {
  const inserted = await tx
    .insert(patients)
    .values(
      FAMILY.map((p) => ({
        userId,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        color: p.color,
        notes: p.notes || null,
      })),
    )
    .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, birthDate: patients.birthDate });

  return { patients: inserted };
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-demo/builders/family.ts
git commit -m "feat(seed): add family builder (4 patients)"
```

---

## Task 7: Seed — budget builder

**Files:**
- Create: `backend/src/scripts/seed-demo/builders/budget.ts`

- [ ] **Step 1: Write `budget.ts`**

```ts
// backend/src/scripts/seed-demo/builders/budget.ts
import type { db } from '@db/client';
import {
  bankAccounts,
  envelopes,
  envelopeTransactions,
  loans,
  loanTransactions,
  recurringEntries,
  salaryArchives,
} from '@db/schema';
import type { Rng } from '../rng.js';
import { intBetween } from '../rng.js';
import { BANK_ACCOUNTS, ENVELOPES, RECURRING } from '../fixtures.js';
import type { SeededFamily } from './family.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function seedBudget(
  tx: Tx,
  userId: string,
  family: SeededFamily,
  rng: Rng,
): Promise<void> {
  // ── Bank accounts ──
  const accounts = await tx
    .insert(bankAccounts)
    .values(BANK_ACCOUNTS.map((a) => ({ userId, name: a.name, initialBalance: a.initialBalance, color: a.color, dotColor: a.dotColor })))
    .returning({ id: bankAccounts.id });

  // ── Envelopes ──
  const insertedEnvelopes = await tx
    .insert(envelopes)
    .values(
      ENVELOPES.map((e, i) => ({
        userId,
        memberId: i % 2 === 0 ? family.patients[0]!.id : family.patients[1]!.id,
        name: e.name,
        type: e.type as any,
        balance: e.balance,
        target: e.target,
        color: e.color,
        dueDay: e.dueDay,
      })),
    )
    .returning({ id: envelopes.id });

  // ── Envelope transactions (2 per envelope, 12 total) ──
  const today = new Date();
  const envelopeTxValues = insertedEnvelopes.flatMap((env, i) => {
    const monthsAgo = (m: number) => new Date(today.getFullYear(), today.getMonth() - m, intBetween(rng, 1, 28)).toISOString().slice(0, 10);
    const target = parseFloat(ENVELOPES[i]!.target);
    const monthlyDeposit = (target / 10).toFixed(2);
    return [
      { envelopeId: env.id, amount: monthlyDeposit, date: monthsAgo(2) },
      { envelopeId: env.id, amount: monthlyDeposit, date: monthsAgo(1) },
    ];
  });
  await tx.insert(envelopeTransactions).values(envelopeTxValues);

  // ── Recurring entries ──
  await tx.insert(recurringEntries).values(
    RECURRING.map((r) => ({
      userId,
      memberId: r.memberIdx === null ? null : family.patients[r.memberIdx]!.id,
      accountId: accounts[r.accountIdx]!.id,
      label: r.label,
      amount: r.amount,
      type: r.type as any,
      dayOfMonth: r.dayOfMonth,
      category: r.category,
    })),
  );

  // ── Loans (2) ──
  const insertedLoans = await tx
    .insert(loans)
    .values([
      {
        userId,
        memberId: family.patients[1]!.id,
        person: 'Pierre (frère Thomas)',
        direction: 'borrowed',
        amount: '1500.00',
        remaining: '800.00',
        description: 'Avance pour réparation voiture',
        date: '2025-12-15',
        dueDate: '2026-08-15',
        dueDay: 15,
      },
      {
        userId,
        memberId: family.patients[0]!.id,
        person: 'Sophie (collègue Marie)',
        direction: 'lent',
        amount: '300.00',
        remaining: '0.00',
        description: 'Dépannage fin de mois',
        date: '2026-01-20',
        dueDate: '2026-02-20',
        dueDay: null,
      },
    ])
    .returning({ id: loans.id });

  // Loan transactions: 3 partial payments on first loan, 1 full on second
  await tx.insert(loanTransactions).values([
    { loanId: insertedLoans[0]!.id, amount: '200.00', date: '2026-01-15' },
    { loanId: insertedLoans[0]!.id, amount: '300.00', date: '2026-02-15' },
    { loanId: insertedLoans[0]!.id, amount: '200.00', date: '2026-03-15' },
    { loanId: insertedLoans[1]!.id, amount: '300.00', date: '2026-02-20' },
  ]);

  // ── Salary archives (6 months: nov 2025 → avril 2026) ──
  const months = ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04'];
  await tx.insert(salaryArchives).values(
    months.map((month) => ({
      userId,
      accountId: accounts[0]!.id,
      month,
      salary: '4950.00',
      totalExpenses: '2664.99',
      totalSpendings: '35.98',
      spendings: [
        { label: 'Netflix', amount: '17.99' },
        { label: 'Spotify Famille', amount: '17.99' },
      ],
    })),
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors. If `as any` causes issues, locate the enum types in `schema.ts` and import them.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-demo/builders/budget.ts
git commit -m "feat(seed): add budget builder (accounts, envelopes, recurring, loans, archives)"
```

---

## Task 8: Seed — medical builder

**Files:**
- Create: `backend/src/scripts/seed-demo/builders/medical.ts`

- [ ] **Step 1: Write `medical.ts`**

```ts
// backend/src/scripts/seed-demo/builders/medical.ts
import type { db } from '@db/client';
import {
  appointments,
  documents,
  medications,
  practitioners,
  prescriptions,
  reminders,
} from '@db/schema';
import type { Rng } from '../rng.js';
import { pick, intBetween } from '../rng.js';
import { PRACTITIONERS, APPOINTMENT_REASONS, MEDICATIONS, DOCUMENTS } from '../fixtures.js';
import type { SeededFamily } from './family.js';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const MINOR_PRACTITIONER_TYPES = new Set(['pediatre', 'orthodontiste']);

function isMinor(birthDate: string): boolean {
  const age = (Date.now() - new Date(birthDate).getTime()) / (365.25 * 24 * 3600 * 1000);
  return age < 18;
}

function dateOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export async function seedMedical(
  tx: Tx,
  userId: string,
  family: SeededFamily,
  rng: Rng,
): Promise<void> {
  // ── Practitioners ──
  const insertedPractitioners = await tx
    .insert(practitioners)
    .values(
      PRACTITIONERS.map((p) => ({
        userId,
        name: p.name,
        type: p.type as any,
        phone: p.phone,
        email: null,
        address: p.address,
      })),
    )
    .returning({ id: practitioners.id, type: practitioners.type });

  // ── Appointments (10 past + 10 upcoming = 20) ──
  type AppointmentInsert = typeof appointments.$inferInsert;
  const apptValues: AppointmentInsert[] = [];

  // 10 past: 8 completed, 1 cancelled, 1 no_show
  const pastStatuses: Array<'completed' | 'cancelled' | 'no_show'> = [
    'completed', 'completed', 'completed', 'completed',
    'completed', 'completed', 'completed', 'completed',
    'cancelled', 'no_show',
  ];
  for (let i = 0; i < 10; i++) {
    const practitioner = insertedPractitioners[i % insertedPractitioners.length]!;
    const eligiblePatients = MINOR_PRACTITIONER_TYPES.has(practitioner.type)
      ? family.patients.filter((p) => isMinor(p.birthDate))
      : family.patients;
    const patient = pick(rng, eligiblePatients);
    const reasons = APPOINTMENT_REASONS[practitioner.type] ?? ['Consultation'];
    apptValues.push({
      userId,
      patientId: patient.id,
      practitionerId: practitioner.id,
      date: dateOffset(-intBetween(rng, 5, 150)),
      time: `${String(intBetween(rng, 8, 18)).padStart(2, '0')}:${pick(rng, ['00', '15', '30', '45'])}`,
      status: pastStatuses[i]!,
      reason: pick(rng, reasons),
      outcome: pastStatuses[i] === 'completed' ? 'RAS, prochain contrôle dans 6 mois' : null,
    });
  }
  // 10 upcoming
  for (let i = 0; i < 10; i++) {
    const practitioner = insertedPractitioners[(i + 3) % insertedPractitioners.length]!;
    const eligiblePatients = MINOR_PRACTITIONER_TYPES.has(practitioner.type)
      ? family.patients.filter((p) => isMinor(p.birthDate))
      : family.patients;
    const patient = pick(rng, eligiblePatients);
    const reasons = APPOINTMENT_REASONS[practitioner.type] ?? ['Consultation'];
    apptValues.push({
      userId,
      patientId: patient.id,
      practitionerId: practitioner.id,
      date: dateOffset(intBetween(rng, 3, 90)),
      time: `${String(intBetween(rng, 8, 18)).padStart(2, '0')}:${pick(rng, ['00', '15', '30', '45'])}`,
      status: 'scheduled',
      reason: pick(rng, reasons),
      outcome: null,
    });
  }
  const insertedAppts = await tx.insert(appointments).values(apptValues).returning({ id: appointments.id, status: appointments.status, patientId: appointments.patientId, practitionerId: appointments.practitionerId, date: appointments.date });

  // ── Prescriptions (4 — linked to 4 most recent completed appts) ──
  const completedAppts = insertedAppts
    .filter((a) => a.status === 'completed')
    .slice(0, 4);
  const insertedPrescriptions = await tx
    .insert(prescriptions)
    .values(
      completedAppts.map((a) => ({
        userId,
        appointmentId: a.id,
        practitionerId: a.practitionerId,
        patientId: a.patientId,
        issuedDate: a.date,
        validUntil: dateOffset(intBetween(rng, 30, 180)),
        notes: 'Renouvelable selon l\'évolution',
      })),
    )
    .returning({ id: prescriptions.id, patientId: prescriptions.patientId });

  // ── Medications (6) ──
  await tx.insert(medications).values(
    MEDICATIONS.map((m, i) => {
      const patient = family.patients[m.patientIdx]!;
      const linkedPrescription = insertedPrescriptions.find((p) => p.patientId === patient.id);
      return {
        userId,
        prescriptionId: i < 4 && linkedPrescription ? linkedPrescription.id : null,
        patientId: patient.id,
        name: m.name,
        type: m.type as any,
        dosage: m.dosage,
        quantity: m.quantity,
        dailyRate: m.dailyRate,
        startDate: dateOffset(-intBetween(rng, 10, 60)),
        alertDaysBefore: m.alertDaysBefore,
        skipDays: [...m.skipDays],
      };
    }),
  );

  // ── Documents (8) ──
  await tx.insert(documents).values(
    DOCUMENTS.map((d) => ({
      userId,
      patientId: family.patients[d.patientIdx]!.id,
      practitionerId: d.practitionerIdx === null ? null : insertedPractitioners[d.practitionerIdx]!.id,
      type: d.type as any,
      title: d.title,
      date: dateOffset(-intBetween(rng, 10, 180)),
      fileUrl: null,
      notes: null,
    })),
  );

  // ── Reminders (3 — on 3 upcoming appts) ──
  const upcomingAppts = insertedAppts.filter((a) => a.status === 'scheduled').slice(0, 3);
  await tx.insert(reminders).values(
    upcomingAppts.map((a) => ({
      userId,
      type: 'email' as const,
      target: 'appointment' as const,
      appointmentId: a.id,
      medicationId: null,
      recipientEmail: 'demo@dashflow.app',
      enabled: true,
    })),
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-demo/builders/medical.ts
git commit -m "feat(seed): add medical builder (practitioners, appts, meds, prescriptions, docs, reminders)"
```

---

## Task 9: Seed — orchestrator

**Files:**
- Create: `backend/src/scripts/seed-demo/index.ts`

- [ ] **Step 1: Write `index.ts`**

```ts
// backend/src/scripts/seed-demo/index.ts
import { hash } from 'argon2';
import { eq, sql } from 'drizzle-orm';
import { db } from '@db/client';
import {
  users,
  patients,
  practitioners,
  appointments,
  bankAccounts,
  envelopes,
  envelopeTransactions,
  loans,
  loanTransactions,
  recurringEntries,
  salaryArchives,
  medications,
  prescriptions,
  documents,
  reminders,
} from '@db/schema';
import { makeRng } from './rng.js';
import { seedFamily } from './builders/family.js';
import { seedBudget } from './builders/budget.js';
import { seedMedical } from './builders/medical.js';

const DEMO_EMAIL = 'demo@dashflow.app';
const DEMO_PASSWORD_PLAIN = 'demo';
const SEED = 42;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function ensureDemoUser(tx: Tx): Promise<string> {
  const [existing] = await tx.select().from(users).where(eq(users.email, DEMO_EMAIL)).limit(1);
  if (existing) {
    if (!existing.isDemoAccount) {
      throw new Error(`User ${DEMO_EMAIL} exists but is not flagged as demo. Aborting.`);
    }
    return existing.id;
  }
  const hashedPassword = await hash(DEMO_PASSWORD_PLAIN);
  const [created] = await tx
    .insert(users)
    .values({
      email: DEMO_EMAIL,
      password: hashedPassword,
      displayName: 'Compte démo',
      emailVerified: new Date(),
      isDemoAccount: true,
    })
    .returning({ id: users.id });
  return created!.id;
}

async function wipeDemoData(tx: Tx, userId: string): Promise<void> {
  // Order matters: children first, parents last.
  await tx.delete(reminders).where(eq(reminders.userId, userId));
  await tx.execute(sql`DELETE FROM envelope_transactions WHERE envelope_id IN (SELECT id FROM envelopes WHERE user_id = ${userId})`);
  await tx.execute(sql`DELETE FROM loan_transactions     WHERE loan_id     IN (SELECT id FROM loans     WHERE user_id = ${userId})`);
  await tx.delete(documents).where(eq(documents.userId, userId));
  await tx.delete(prescriptions).where(eq(prescriptions.userId, userId));
  await tx.delete(medications).where(eq(medications.userId, userId));
  await tx.delete(appointments).where(eq(appointments.userId, userId));
  await tx.delete(salaryArchives).where(eq(salaryArchives.userId, userId));
  await tx.delete(recurringEntries).where(eq(recurringEntries.userId, userId));
  await tx.delete(loans).where(eq(loans.userId, userId));
  await tx.delete(envelopes).where(eq(envelopes.userId, userId));
  await tx.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
  await tx.delete(patients).where(eq(patients.userId, userId));
  await tx.delete(practitioners).where(eq(practitioners.userId, userId));
}

async function validate(tx: Tx, userId: string): Promise<void> {
  const counts = {
    patients:           (await tx.select().from(patients).where(eq(patients.userId, userId))).length,
    practitioners:      (await tx.select().from(practitioners).where(eq(practitioners.userId, userId))).length,
    bankAccounts:       (await tx.select().from(bankAccounts).where(eq(bankAccounts.userId, userId))).length,
    envelopes:          (await tx.select().from(envelopes).where(eq(envelopes.userId, userId))).length,
    recurringEntries:   (await tx.select().from(recurringEntries).where(eq(recurringEntries.userId, userId))).length,
    appointments:       (await tx.select().from(appointments).where(eq(appointments.userId, userId))).length,
    medications:        (await tx.select().from(medications).where(eq(medications.userId, userId))).length,
    documents:          (await tx.select().from(documents).where(eq(documents.userId, userId))).length,
  };
  const expected = { patients: 4, practitioners: 8, bankAccounts: 3, envelopes: 6, recurringEntries: 15, appointments: 20, medications: 6, documents: 8 };
  for (const [k, v] of Object.entries(expected)) {
    if (counts[k as keyof typeof counts] !== v) {
      throw new Error(`Validation failed: expected ${k}=${v}, got ${counts[k as keyof typeof counts]}`);
    }
  }
  console.log('[seed-demo] validation OK', counts);
}

export async function runDemoReset(opts: { wipeFirst?: boolean } = { wipeFirst: true }): Promise<void> {
  await db.transaction(async (tx) => {
    const userId = await ensureDemoUser(tx);
    if (opts.wipeFirst) await wipeDemoData(tx, userId);
    const rng = makeRng(SEED);
    const family = await seedFamily(tx, userId);
    await seedBudget(tx, userId, family, rng);
    await seedMedical(tx, userId, family, rng);
    await validate(tx, userId);
  });
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add backend/src/scripts/seed-demo/index.ts
git commit -m "feat(seed): add orchestrator with ensureDemoUser, wipe, validate"
```

---

## Task 10: Seed — CLI entrypoint + scripts + initial run

**Files:**
- Create: `backend/src/scripts/seed-demo.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Write the CLI entrypoint**

```ts
// backend/src/scripts/seed-demo.ts
import '../env.js';
import { runDemoReset } from './seed-demo/index.js';

const isReset = process.argv.includes('--reset');

try {
  await runDemoReset({ wipeFirst: isReset });
  console.log(`[seed-demo] OK — ${isReset ? 'reset' : 'init'} complete`);
  process.exit(0);
} catch (err) {
  console.error('[seed-demo] FAIL', err);
  process.exit(1);
}
```

- [ ] **Step 2: Add npm scripts**

In `backend/package.json`, add to the `scripts` block:

```json
"seed:demo": "tsx src/scripts/seed-demo.ts",
"seed:demo:reset": "tsx src/scripts/seed-demo.ts --reset"
```

- [ ] **Step 3: Run initial seed**

Run: `cd backend && pnpm seed:demo`
Expected: log `[seed-demo] validation OK { patients: 4, ... }` then `[seed-demo] OK — init complete`. Exit code 0.

- [ ] **Step 4: Run again to confirm idempotence**

Run: `cd backend && pnpm seed:demo`
Expected: error `User demo@dashflow.app exists but is not flagged as demo` should NOT appear (since we set the flag). Instead the script should fail because `seedFamily` re-inserts patients with same userId → unique constraint? Actually no, patients have no unique constraint on (userId, firstName). It will insert 4 MORE patients.
This proves `--reset` is required for re-runs:

```bash
cd backend && pnpm seed:demo:reset
```
Expected: log `validation OK`, exit 0. The DB still has exactly 4 patients (wipe + re-seed).

- [ ] **Step 5: Verify counts in DB**

```bash
psql "$DATABASE_URL" -c "SELECT
  (SELECT count(*) FROM patients      WHERE user_id = (SELECT id FROM users WHERE email='demo@dashflow.app')) AS patients,
  (SELECT count(*) FROM appointments  WHERE user_id = (SELECT id FROM users WHERE email='demo@dashflow.app')) AS appts,
  (SELECT count(*) FROM medications   WHERE user_id = (SELECT id FROM users WHERE email='demo@dashflow.app')) AS meds;"
```
Expected: `patients=4, appts=20, meds=6`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/seed-demo.ts backend/package.json backend/pnpm-lock.yaml
git commit -m "feat(seed): add CLI entrypoint and pnpm scripts (seed:demo, seed:demo:reset)"
```

---

## Task 11: Backend — `POST /auth/demo-reset`

**Files:**
- Modify: `backend/src/routes/auth.routes.ts`

- [ ] **Step 1: Add the route**

At the bottom of `backend/src/routes/auth.routes.ts`, just before `export default auth;`, add:

```ts
import { runDemoReset } from '../scripts/seed-demo/index.js';

// ── Demo Reset (auth required, isDemoAccount only) ──
auth.post('/demo-reset', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isDemoAccount) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  try {
    await runDemoReset();
    return c.json({ ok: true });
  } catch (err) {
    console.error('[auth] Demo reset failed', err);
    return c.json({ error: 'Reset failed' }, 500);
  }
});
```

- [ ] **Step 2: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Smoke test (DEMO_ENABLED=true, after seed)**

```bash
cd backend && DEMO_ENABLED=true pnpm dev &
sleep 2

# 1. Get JWT via demo-login
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/demo-login | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")

# 2. Call demo-reset
curl -i -X POST http://localhost:3000/api/auth/demo-reset \
  -H "Authorization: Bearer $TOKEN"
```
Expected: HTTP 200 with `{"ok":true}`. Kill the backend.

- [ ] **Step 4: Smoke test forbidden case**

Register a normal user, log in to get their token, then call `/demo-reset`. Expected: HTTP 403.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/auth.routes.ts
git commit -m "feat(auth): add POST /auth/demo-reset (demo account only)"
```

---

## Task 12: Cron — `node-cron` + `startDemoResetCron`

**Files:**
- Create: `backend/src/cron/demo-reset.ts`
- Modify: `backend/package.json`, `backend/src/index.ts`

- [ ] **Step 1: Add `node-cron` dep**

```bash
cd backend && pnpm add node-cron && pnpm add -D @types/node-cron
```
Expected: package.json updated, lockfile updated.

- [ ] **Step 2: Write cron module**

```ts
// backend/src/cron/demo-reset.ts
import cron from 'node-cron';
import { runDemoReset } from '../scripts/seed-demo/index.js';

export function startDemoResetCron(): void {
  if (process.env['DEMO_ENABLED'] !== 'true') return;

  cron.schedule('0 */6 * * *', async () => {
    console.log('[cron] Reset démo démarré');
    try {
      await runDemoReset();
      console.log('[cron] Reset démo OK');
    } catch (err) {
      console.error('[cron] Reset démo FAIL', err);
    }
  });

  console.log('[cron] Demo reset planifié (toutes les 6h)');
}
```

- [ ] **Step 3: Wire in `index.ts`**

In `backend/src/index.ts`, find the line `serve({ fetch: app.fetch, port });` (last line of file) and replace it with:

```ts
import { startDemoResetCron } from './cron/demo-reset.js';

// ── Cron jobs ──
startDemoResetCron();

serve({ fetch: app.fetch, port });
```

The `import` line goes at the top of the file with the other imports — move it there (don't keep it at the bottom).

- [ ] **Step 4: Type-check**

Run: `cd backend && pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Smoke boot test (DEMO_ENABLED=true)**

```bash
cd backend && DEMO_ENABLED=true pnpm dev &
sleep 2
```
Expected log: `[cron] Demo reset planifié (toutes les 6h)`. Kill the backend.

- [ ] **Step 6: Smoke boot test (DEMO_ENABLED=false)**

```bash
cd backend && DEMO_ENABLED=false pnpm dev &
sleep 2
```
Expected: NO `[cron]` log. Kill the backend.

- [ ] **Step 7: Commit**

```bash
git add backend/src/cron/demo-reset.ts backend/src/index.ts backend/package.json backend/pnpm-lock.yaml
git commit -m "feat(cron): schedule demo reset every 6h via node-cron"
```

---

## Task 13: Frontend — `AuthStore` demo bypass + `demoLogin`

**Files:**
- Modify: `src/app/features/auth/domain/auth.store.ts`
- Create: `src/app/features/auth/domain/auth.store.spec.ts`

- [ ] **Step 1: Update `AuthUser` type and computed flags**

In `src/app/features/auth/domain/auth.store.ts`, find `export type AuthUser = { ... }` (around line 12) and add `isDemoAccount`:

```ts
export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  totpEnabled: boolean;
  hasPassword: boolean;
  googleLinked: boolean;
  encryptionVersion: number;
  hasEncryptionPassphrase: boolean;
  isDemoAccount: boolean;
};
```

Find the `needsEncryptionSetup` and `needsUnlock` computed signals. Replace them with:

```ts
readonly needsEncryptionSetup = computed(() =>
  this.isAuthenticated()
  && this.encryptionVersion() === 0
  && !this._user()?.isDemoAccount
);

readonly needsUnlock = computed(() =>
  this.isAuthenticated()
  && this.encryptionVersion() === 1
  && !this.crypto.isUnlocked()
  && !this._user()?.isDemoAccount
);
```

- [ ] **Step 2: Add `demoLogin` method**

In the same file, after the `register` method, add:

```ts
async demoLogin(): Promise<void> {
  this._isLoading.set(true);
  try {
    const res = await firstValueFrom(
      this.api.post<{ token: string; user: AuthUser; keyMaterial: null }>('/auth/demo-login', {}),
    );
    this.api.setToken(res.token);
    this._user.set(res.user);
    this._isAuthenticated.set(true);
    this._keyMaterial = null;
  } finally {
    this._isLoading.set(false);
  }
}
```

- [ ] **Step 3: Write regression test**

```ts
// src/app/features/auth/domain/auth.store.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthStore, type AuthUser } from './auth.store';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { of } from 'rxjs';

describe('AuthStore — demo account bypass', () => {
  function makeUser(over: Partial<AuthUser> = {}): AuthUser {
    return {
      id: 'u1',
      email: 'x@x',
      displayName: null,
      avatarUrl: null,
      totpEnabled: false,
      hasPassword: true,
      googleLinked: false,
      encryptionVersion: 0,
      hasEncryptionPassphrase: false,
      isDemoAccount: false,
      ...over,
    };
  }

  let store: AuthStore;
  const mockApi = { getToken: () => null, setToken: vi.fn(), clearToken: vi.fn(), get: vi.fn(), post: vi.fn() };
  const mockCrypto = { isUnlocked: () => false, restoreFromSession: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApiClient, useValue: mockApi },
        { provide: CryptoStore, useValue: mockCrypto },
      ],
    });
    store = TestBed.inject(AuthStore);
  });

  it('needsEncryptionSetup is FALSE for demo account with version 0', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 0, isDemoAccount: true }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsEncryptionSetup()).toBe(false);
  });

  it('needsEncryptionSetup is TRUE for normal user with version 0', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 0, isDemoAccount: false }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsEncryptionSetup()).toBe(true);
  });

  it('needsUnlock is FALSE for demo account with version 1 and locked crypto', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 1, isDemoAccount: true }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsUnlock()).toBe(false);
  });

  it('needsUnlock is TRUE for normal user with version 1 and locked crypto', () => {
    (store as any)._user.set(makeUser({ encryptionVersion: 1, isDemoAccount: false }));
    (store as any)._isAuthenticated.set(true);
    expect(store.needsUnlock()).toBe(true);
  });

  it('demoLogin posts to /auth/demo-login and stores token + user', async () => {
    const demoUser = makeUser({ isDemoAccount: true, email: 'demo@dashflow.app' });
    mockApi.post.mockReturnValue(of({ token: 'jwt', user: demoUser, keyMaterial: null }));

    await store.demoLogin();

    expect(mockApi.post).toHaveBeenCalledWith('/auth/demo-login', {});
    expect(mockApi.setToken).toHaveBeenCalledWith('jwt');
    expect(store.user()).toEqual(demoUser);
    expect(store.isAuthenticated()).toBe(true);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- --run src/app/features/auth/domain/auth.store.spec.ts`
Expected: 5/5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/app/features/auth/domain/auth.store.ts src/app/features/auth/domain/auth.store.spec.ts
git commit -m "feat(auth): bypass encryption setup/unlock for demo account, add demoLogin"
```

---

## Task 14: Frontend — Landing CTA wiring

**Files:**
- Modify: `src/app/pages/landing/landing.ts`

- [ ] **Step 1: Inspect existing CTA wiring**

Run: `grep -n 'demoUrl\|DEMO_URL' src/app/pages/landing/landing.ts`
Expected output: 5 matches around lines 7, 60, 90, 343, 401. Note the structure — they are `[href]="demoUrl"` attribute bindings on `<a>` tags.

- [ ] **Step 2: Replace `DEMO_URL` constant + handler**

In `src/app/pages/landing/landing.ts`:

1. Delete the line `const DEMO_URL = 'https://dashflow.j-ned.dev/auth/register';` (line 7).
2. Find `protected readonly demoUrl = DEMO_URL;` (line 401) and replace the entire class member with:

```ts
private readonly authStore = inject(AuthStore);
private readonly router = inject(Router);
protected readonly demoLoading = signal(false);

protected async onDemoClick(event: Event): Promise<void> {
  event.preventDefault();
  if (this.demoLoading()) return;
  this.demoLoading.set(true);
  try {
    await this.authStore.demoLogin();
    await this.router.navigate(['/budget']);
  } catch (err) {
    console.error('Demo login failed', err);
    this.demoLoading.set(false);
  }
}
```

3. Add the imports at the top of the file:

```ts
import { inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';
```

(Merge with existing `@angular/core` import line — don't duplicate.)

4. Replace each occurrence of `[href]="demoUrl"` (3 sites: lines 60, 90, 343) with:

```html
href="#" (click)="onDemoClick($event)" [attr.aria-busy]="demoLoading()"
```

- [ ] **Step 3: Type-check**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Manual smoke test**

```bash
cd backend && DEMO_ENABLED=true pnpm dev &
cd .. && pnpm start &
```
Open `http://localhost:4200`. Click any "Démo live" button. Expected: redirect to `/budget` showing seeded data (3 accounts, 6 envelopes, etc.). Kill both processes.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/landing/landing.ts
git commit -m "feat(landing): wire Démo live CTA to demoLogin instead of register"
```

---

## Task 15: Frontend — demo banner component

**Files:**
- Create: `src/app/layout/components/demo-banner/demo-banner.ts`
- Modify: `src/app/layout/app-shell/app-shell.ts` (or whatever file embeds the main app shell)

- [ ] **Step 1: Locate the app-shell**

Run: `find src/app -path '*/layout/*' -name '*.ts' | head` and `grep -rn 'router-outlet' src/app/layout`
Identify the parent component that wraps `<router-outlet>` for authenticated routes — this is where the banner lives.

- [ ] **Step 2: Write the banner component**

```ts
// src/app/layout/components/demo-banner/demo-banner.ts
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '@features/auth/domain/auth.store';
import { ApiClient } from '@core/services/api/api-client';

@Component({
  selector: 'app-demo-banner',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div role="status" class="demo-banner">
        <span class="demo-banner__label">{{ 'demo.banner.label' | transloco }}</span>
        <span class="demo-banner__sep" aria-hidden="true">·</span>
        <span class="demo-banner__hint">{{ 'demo.banner.resetEvery' | transloco }}</span>
        <button type="button" class="demo-banner__action" [disabled]="resetting()" (click)="onReset()">
          {{ 'demo.banner.resetNow' | transloco }}
        </button>
      </div>
    }
  `,
  styles: `
    .demo-banner {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background-color: rgb(245 158 11 / 0.1);
      color: rgb(180 83 9);
      font-size: 0.875rem;
      border-bottom: 1px solid rgb(245 158 11 / 0.25);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .demo-banner__sep { opacity: 0.5; }
    .demo-banner__action {
      margin-left: auto;
      min-height: 44px;
      padding: 0 0.875rem;
      border-radius: 0.375rem;
      background-color: rgb(245 158 11 / 0.2);
      color: rgb(120 53 15);
      font-weight: 500;
      cursor: pointer;
      border: none;
    }
    .demo-banner__action:hover:not(:disabled) { background-color: rgb(245 158 11 / 0.3); }
    .demo-banner__action:focus-visible { outline: 2px solid rgb(245 158 11); outline-offset: 2px; }
    .demo-banner__action:disabled { opacity: 0.5; cursor: wait; }
  `,
})
export class DemoBanner {
  private readonly auth = inject(AuthStore);
  private readonly api = inject(ApiClient);

  protected readonly visible = computed(() => !!this.auth.user()?.isDemoAccount);
  protected readonly resetting = signal(false);

  protected async onReset(): Promise<void> {
    if (this.resetting()) return;
    this.resetting.set(true);
    try {
      await firstValueFrom(this.api.post('/auth/demo-reset', {}));
      window.location.reload();
    } catch (err) {
      console.error('Demo reset failed', err);
      this.resetting.set(false);
    }
  }
}
```

- [ ] **Step 3: Embed in app-shell**

In the app-shell template found in Step 1, add `<app-demo-banner />` just below the header (above `<router-outlet />`). Add the import to the component class:

```ts
import { DemoBanner } from '@layout/components/demo-banner/demo-banner';

// in the @Component decorator imports array:
imports: [/* existing... */ DemoBanner],
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Manual smoke test**

Boot backend + frontend (as in Task 14, Step 4). Click "Démo live" → land on `/budget`. Expected: amber banner visible at the top of the app showing "Compte démo · Réinitialisé toutes les 6 heures" + "Réinitialiser maintenant" button. Click the button → page reloads, banner still visible (data has been reset, identical because seed is deterministic).

- [ ] **Step 6: Commit**

```bash
git add src/app/layout/components/demo-banner/demo-banner.ts src/app/layout/app-shell/app-shell.ts
git commit -m "feat(layout): add demo banner with reset button"
```

(Adjust path of `app-shell.ts` to match the file you actually modified in Step 3.)

---

## Task 16: Frontend — i18n keys

**Files:**
- Modify: `src/assets/i18n/fr.json`, `src/assets/i18n/en.json`

- [ ] **Step 1: Add FR keys**

In `src/assets/i18n/fr.json`, add a top-level `"demo"` block (alphabetical order if the file is sorted, otherwise at end):

```json
"demo": {
  "banner": {
    "label": "Compte démo",
    "resetEvery": "Réinitialisé toutes les 6 heures",
    "resetNow": "Réinitialiser maintenant"
  },
  "login": {
    "loading": "Chargement de la démo…",
    "error": "Impossible de charger la démo, réessayez"
  }
}
```

- [ ] **Step 2: Add EN keys**

In `src/assets/i18n/en.json`, add the matching block:

```json
"demo": {
  "banner": {
    "label": "Demo account",
    "resetEvery": "Resets every 6 hours",
    "resetNow": "Reset now"
  },
  "login": {
    "loading": "Loading demo…",
    "error": "Could not load demo, please retry"
  }
}
```

- [ ] **Step 3: Validate JSON**

Run: `python3 -c "import json; json.load(open('src/assets/i18n/fr.json')); json.load(open('src/assets/i18n/en.json')); print('OK')"`
Expected: `OK`.

- [ ] **Step 4: Visual smoke test**

Boot the app. Toggle language EN/FR via existing toggle. Banner label should switch correspondingly.

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n/fr.json src/assets/i18n/en.json
git commit -m "feat(i18n): add demo.banner and demo.login keys (FR/EN)"
```

---

## Task 17: Docs — `.env.example` + final verification

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: Document `DEMO_ENABLED`**

Append to `backend/.env.example`:

```bash

# ── Demo account ──
# Set to 'true' to expose POST /auth/demo-login (one-click public demo)
# and enable the 6h cron reset. Defaults to 'false' (self-hosters).
DEMO_ENABLED=false
```

- [ ] **Step 2: End-to-end verification**

```bash
# 1. Migration applied
cd backend && pnpm db:migrate

# 2. Seed runs clean
pnpm seed:demo:reset

# 3. Both services up with demo enabled
DEMO_ENABLED=true pnpm dev &
cd .. && pnpm start &

# 4. Browser: open http://localhost:4200
# 5. Click "Démo live" on landing → land on /budget
# 6. Verify visible in app:
#    - 3 bank accounts (Compte joint, Marie - perso, Livret A)
#    - 6 envelopes
#    - ~15 recurring entries in the corresponding view
#    - Medical view: 4 patients, 8 practitioners, 20 appointments
# 7. Click "Réinitialiser maintenant" in the demo banner → reload, data identical (seed=42)
# 8. Logout → no longer in demo, banner gone
# 9. Stop processes
```

- [ ] **Step 3: Commit**

```bash
git add backend/.env.example
git commit -m "docs(env): document DEMO_ENABLED flag"
```

- [ ] **Step 4: Final review**

Run: `git log --oneline master..HEAD`
Expected: 17 commits, one per task. Branch is ready to merge.

---

## Self-Review Notes

- Spec coverage: every section of the spec maps to a task (DB migration → T1, auth helpers → T2, demo-login → T3, RNG → T4, fixtures → T5, family → T6, budget → T7, medical → T8, orchestrator → T9, CLI → T10, demo-reset → T11, cron → T12, AuthStore → T13, landing CTA → T14, banner → T15, i18n → T16, docs → T17).
- Type consistency: `runDemoReset` signature is consistent across tasks 9, 11, 12. `AuthUser.isDemoAccount` is added in T2 (backend toPublicUser) and T13 (frontend type). `seedFamily / seedBudget / seedMedical` signatures match between definition (T6/T7/T8) and call site (T9).
- No placeholders. All code blocks contain runnable code. All test commands have expected output.
- Validation in T9 (`validate(tx, userId)`) provides built-in smoke testing without adding a backend test framework — pragmatic call for a solo-dev PH launch.
