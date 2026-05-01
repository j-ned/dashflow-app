# Compte démo public pour ProductHunt

**Date** : 2026-05-01
**Auteur** : Julien Nédellec (avec Claude)
**Statut** : design validé, prêt pour implementation plan

## Contexte

DashFlow doit lancer sur ProductHunt avec une démo live qui permette aux visiteurs d'explorer le produit en un clic, sans inscription. Le bouton "Démo live" de la landing pointe actuellement vers `/auth/register` (cf. `src/app/pages/landing/landing.ts:7`), ce qui force le visiteur à créer un compte vide. Pour PH, il faut un compte unique pré-rempli, partagé entre tous les visiteurs, avec reset automatique pour limiter le vandalisme.

## Objectifs

1. Le visiteur PH clique "Démo live" et arrive en moins de 2 secondes dans une app **pleine de données réalistes** (budget + médical), sans formulaire ni passphrase à entrer.
2. Le compte démo se réinitialise tout seul **toutes les 6h** (vandalisme limité).
3. La feature peut être désactivée via une **variable d'environnement** (la démo n'est pas exposée chez les self-hosters).
4. Aucune régression sur le flow d'auth existant : le bypass E2EE est strictement limité au compte démo identifié par un flag DB.

## Non-objectifs

- Compte éphémère par visiteur (un compte jetable créé à chaque clic) : trop coûteux à maintenir, pas le sweet spot pour un solo dev.
- Mode read-only : un visiteur PH qui ne peut rien cliquer ne se rend pas compte de la valeur du produit.
- Génération de données chiffrées E2EE : le compte démo bypasse l'E2EE — la donnée n'est pas sensible et le crypto setup ajouterait de la friction inutile.
- I18n des données seedées : tout reste en français (membres, RDV, raisons médicales). EN est uniquement pour l'UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Landing page                              │
│  [Démo live] ─────POST /auth/demo-login──────┐               │
└─────────────────────────────────────────────┼───────────────┘
                                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend Hono                                                │
│                                                              │
│  routes/auth.routes.ts                                       │
│   POST /auth/demo-login (no-auth, rate-limited 10/min/IP)    │
│   ├─ vérifie DEMO_ENABLED=true                               │
│   ├─ select user where is_demo_account=true                  │
│   └─ retourne JWT + user (skip MFA, skip encryption)         │
│                                                              │
│   POST /auth/demo-reset (auth requise, isDemoAccount only)   │
│   └─ déclenche runDemoReset() à la demande                   │
│                                                              │
│  scripts/seed-demo.ts (CLI + cron)                           │
│   ├─ ensureDemoUser (INSERT IF NOT EXISTS)                   │
│   ├─ wipeDemoData WHERE user_id = demo                       │
│   ├─ insert ~100 entités déterministes (RNG seedé = 42)        │
│   └─ commit en transaction                                   │
│                                                              │
│  cron interne (node-cron)                                    │
│   └─ "0 */6 * * *" → runDemoReset()                          │
└─────────────────────────────────────────────────────────────┘
                                              │
┌─────────────────────────────────────────────▼───────────────┐
│  PostgreSQL                                                  │
│   users.is_demo_account BOOLEAN DEFAULT false                │
│   (toutes les autres tables — données en clair, pas E2EE)    │
└─────────────────────────────────────────────────────────────┘
                                              ▲
┌─────────────────────────────────────────────┴───────────────┐
│  Frontend Angular                                            │
│  AuthStore.demoLogin() → stocke JWT + user                   │
│  needsEncryptionSetup → false si user.isDemoAccount          │
│  app-shell : banner "Compte démo · reset toutes les 6h"      │
└─────────────────────────────────────────────────────────────┘
```

### Décisions structurelles

- **Pas de E2EE pour le compte démo.** `encryption_version` reste à 0 et le flag `is_demo_account` court-circuite le redirect `encryption-setup` côté frontend. Les routes backend acceptent déjà les payloads en clair (`if (body.encryptedData)` sinon clair) — vérifié dans `bank-account.routes.ts:18-43`.
- **Seed déterministe** (RNG mulberry32 seedé à 42). Reproductible, debug facile, comparable d'un run à l'autre.
- **Cron interne node-cron** plutôt que cron système ou Docker scheduled job. Le backend tourne déjà en process persistent ; pas besoin d'orchestration externe.
- **Rate-limit sur `/auth/demo-login`** (10 req/min/IP). Protège contre le flood JWT (chaque appel crée un token signé, coût CPU non négligeable).
- **Variable d'env `DEMO_ENABLED`**. Permet de désactiver la démo en prod self-hosted (1-click switch) tout en gardant le code dans le binaire.

## Modèle de données seedé

Famille fictive **Dubois** (4 personnes), Paris 11/12. Toutes les FK et dates s'alignent.

### Membres / patients (4)

Note schéma : il n'existe pas de table `members` séparée. Les colonnes `member_id` dans `envelopes`, `loans`, `recurring_entries` pointent toutes sur `patients.id` (vérifié dans `0000_rapid_kid_colt.sql:250-270`). Les "membres de la famille" du côté budget et les "patients" du côté médical sont **les mêmes 4 lignes** dans la table `patients`.

| Prénom | Nom | Naissance | Color |
|---|---|---|---|
| Marie | Dubois | 1987-04-12 | #E11D48 |
| Thomas | Dubois | 1985-09-23 | #2563EB |
| Lucas | Dubois | 2017-11-04 | #16A34A |
| Léa | Dubois | 2013-06-28 | #9333EA |

Avec `notes` médicales courtes ("Allergie pénicilline" pour Marie, etc.).

### Bank accounts (3)

| Nom | Solde initial | Couleur |
|---|---|---|
| Compte joint (BNP) | 5 200,00 € | #16A34A |
| Marie - perso (Boursorama) | 1 800,00 € | #E11D48 |
| Livret A famille (La Banque Postale) | 12 400,00 € | #2563EB |

### Envelopes (6)

| Nom | Type | Balance / Target | Due day |
|---|---|---|---|
| Vacances été 2026 | vacances | 2 000 / 3 000 € | 15 |
| Impôts foncier | impôts | 800 / 1 200 € | — |
| Épargne urgence | épargne | 5 000 / 10 000 € | — |
| Voiture (révision) | équipement | 1 500 / 3 000 € | — |
| Travaux salle de bain | équipement | 400 / 2 500 € | — |
| Cadeaux Noël 2026 | épargne | 180 / 500 € | — |

Plus 12 `envelope_transactions` (dépôts mensuels et retraits ponctuels) étalés sur 3 mois.

### Recurring entries (15)

**Income (2)** : Salaire Thomas +2 850 € (day 28, joint) · Salaire Marie +2 100 € (day 30, perso Marie)
**Expense (8)** : Loyer -1 200 € · Courses -650 € · EDF -120 € · Internet Free -39,99 € · Mutuelle famille -180 € · Assurance auto -85 € · Cantine Lucas+Léa -210 € · Essence -180 €
**Annual (3)** : Taxe foncière -1 450 € (oct) · Taxe habitation -680 € (nov) · Assurance habitation -340 € (juin)
**Spending / abos (2)** : Netflix -17,99 € · Spotify Famille -17,99 €

### Loans (2)

- Pierre (frère Thomas) · `borrowed` · 1 500 € (reste 800 €) · 3 transactions de remboursement
- Sophie (collègue) · `lent` · 300 € (reste 0 €) · 1 transaction de remboursement intégral

### Salary archives (6 mois)

Nov 2025 → avril 2026. Pour chaque mois : `salary` + `total_expenses` + `total_spendings` + `spendings` JSON. Les chiffres dérivent des `recurring_entries` du mois.

### Practitioners (8)

| Nom | Type | Localisation |
|---|---|---|
| Dr Sophie Martin | généraliste | Paris 11 |
| Dr Camille Lemoine | pédiatre | Paris 11 |
| Dr Antoine Roux | dentiste | Paris 12 |
| Dr Clara Bernard | ophtalmologue | Paris 11 |
| Mme Julie Dubois | kinésithérapeute | Paris 11 |
| Dr Marc Petit | orthodontiste | Paris 12 |
| Dr Léa Garnier | dermatologue | Paris 11 |
| Mme Anne Lefèvre | psychologue | Paris 11 |

### Appointments (20)

10 passés (`completed` × 8, `cancelled` × 1, `no_show` × 1) + 10 à venir (`scheduled`). Répartis sur les 4 patients avec des raisons réalistes ("Contrôle annuel", "Bilan ortho", "Suivi thyroïde", "Vaccin DTP", "Carie molaire", etc.).

### Medications (6)

| Médicament | Patient | Type | daily_rate | Notes |
|---|---|---|---|---|
| Levothyrox 50µg | Marie | comprime | 1 | chronique, alert 14j |
| Doliprane 500mg | Lucas | comprime | variable | ponctuel, skip dim/sam |
| Vitamine D Zyma | Léa | gouttes | 0,5 | 6 mois |
| Smecta | Lucas | sirop | 3 | 5 jours |
| Crème hydrocortisone | Léa | creme | 2 | 14 jours |
| Aspégic 500 | Thomas | gelule | variable | ponctuel |

### Prescriptions (4)

Liées aux 4 RDV `completed` les plus récents.

### Documents (8)

3 `compte_rendu` (RDV passés) · 2 `facture` (mutuelle) · 1 `bilan` (sang Marie) · 1 `certificat` (sport Lucas école) · 1 `courrier` (orientation pédiatre → ortho pour Lucas).

### Reminders (3)

Email + iCal sur les 3 prochains RDV.

### Règles de cohérence

- Tous les `created_at` sont étalés sur 6 mois (nov 2025 → avril 2026), pas tous "aujourd'hui".
- Salaires payés le 28/30 → soldes des comptes cohérents avec l'historique.
- RDV pédiatre uniquement pour Lucas/Léa (pas Marie/Thomas).
- Levothyrox = `chronique` → `daily_rate=1`, `quantity=90`, `alert_days_before=14`.
- Tous les noms/adresses **fictifs mais français crédibles**.

## Migration DB

```sql
-- backend/drizzle/0001_demo_account.sql
ALTER TABLE "users" ADD COLUMN "is_demo_account" boolean DEFAULT false NOT NULL;
CREATE INDEX "users_is_demo_account_idx" ON "users"("is_demo_account") WHERE "is_demo_account" = true;
```

Index partiel : 1 seule ligne demo, lookup O(1).

Update `backend/src/db/schema.ts` :

```ts
export const users = pgTable('users', {
  // ... existing
  isDemoAccount: boolean('is_demo_account').notNull().default(false),
});
```

## Auth flow

### Backend — `backend/src/routes/auth.routes.ts`

```ts
auth.post('/demo-login', rateLimiter({ windowMs: 60_000, limit: 10 }), async (c) => {
  if (process.env['DEMO_ENABLED'] !== 'true') {
    return c.json({ error: 'Demo désactivée' }, 403);
  }
  const [user] = await db.select()
    .from(users)
    .where(eq(users.isDemoAccount, true))
    .limit(1);
  if (!user) return c.json({ error: 'Compte démo non initialisé' }, 503);

  const token = await signToken({ sub: user.id, email: user.email });
  return c.json({ token, user: toPublicUser(user), keyMaterial: null });
});

auth.post('/demo-reset', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.isDemoAccount) return c.json({ error: 'Forbidden' }, 403);
  await runDemoReset();
  return c.json({ ok: true });
});
```

`toPublicUser()` ajoute `isDemoAccount: user.isDemoAccount`.

`/auth/register` refuse explicitement l'email `demo@dashflow.app` → 409 Conflict.

### Frontend — `src/app/features/auth/domain/auth.store.ts`

```ts
export type AuthUser = {
  // ... existing
  isDemoAccount: boolean;
};

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

async demoLogin(): Promise<void> {
  const res = await firstValueFrom(
    this.api.post<{ token: string; user: AuthUser }>('/auth/demo-login', {}),
  );
  this.api.setToken(res.token);
  this._user.set(res.user);
  this._isAuthenticated.set(true);
  this._isLoading.set(false);
}
```

### Frontend gateways

Aucun changement nécessaire. Les HTTP gateways font déjà :

```ts
const key = this.crypto.getMasterKey();
if (!key) return this.api.post('/bank-accounts', data);
```

Pour le compte démo, `crypto.getMasterKey()` retourne `null` → tout passe en clair, exactement le format des données seedées en DB.

### Landing CTA — `src/app/pages/landing/landing.ts`

Le `DEMO_URL` constant est remplacé par un handler :

```ts
async onDemoClick(event: Event) {
  event.preventDefault();
  await this.authStore.demoLogin();
  this.router.navigate(['/budget']);
}
```

Tous les boutons "Démo live" (3 occurrences dans `landing.ts`) bind sur cet handler avec un état de chargement (`demo.login.loading`).

### Banner démo — composant dans app-shell

```html
@if (auth.user()?.isDemoAccount) {
  <div class="demo-banner" role="status">
    <span>{{ 'demo.banner.label' | transloco }}</span>
    <span>{{ 'demo.banner.resetEvery' | transloco }}</span>
    <button (click)="resetDemo()" type="button">
      {{ 'demo.banner.resetNow' | transloco }}
    </button>
  </div>
}
```

Position : top de l'app-shell, sous le header, sticky. Fond `bg-ib-amber-10`, texte `text-ib-amber-90`. Bouton "Réinitialiser maintenant" → `POST /auth/demo-reset` → confirm modal → `window.location.reload()`. Touch target ≥ 44px. Pas d'animation d'entrée (respect `prefers-reduced-motion`).

## Seed script

### Structure

```
backend/src/scripts/
  seed-demo.ts                  # entrypoint CLI
  seed-demo/
    rng.ts                      # mulberry32 seeded RNG
    fixtures.ts                 # constantes : noms, montants, raisons RDV
    builders/
      family.ts                 # user + members + patients
      budget.ts                 # accounts + envelopes + recurring + loans + archives
      medical.ts                # practitioners + appointments + medications + prescriptions + documents
    index.ts                    # orchestrateur : ensureDemoUser + wipe + insert dans une tx
```

### Entrypoint

```ts
// backend/src/scripts/seed-demo.ts
import { db } from '@db/client';
import { runDemoReset } from './seed-demo/index.js';

const isReset = process.argv.includes('--reset');
await runDemoReset({ wipeFirst: isReset });
console.log('[seed-demo] OK — ~100 entités créées');
```

### Orchestrateur

```ts
// backend/src/scripts/seed-demo/index.ts
export async function runDemoReset(opts: { wipeFirst?: boolean } = { wipeFirst: true }) {
  await db.transaction(async (tx) => {
    const userId = await ensureDemoUser(tx);
    if (opts.wipeFirst) await wipeDemoData(tx, userId);
    const rng = makeRng(42);
    const family = await seedFamily(tx, userId, rng);
    await seedBudget(tx, userId, family.members, rng);
    await seedMedical(tx, userId, family.patients, rng);
  });
}
```

### `ensureDemoUser`

INSERT IF NOT EXISTS sur `users` avec `email = demo@dashflow.app`, `password = argon2('demo')`, `is_demo_account = true`, `email_verified = now()`, `display_name = 'Compte démo'`.

### `wipeDemoData` — ordre FK

```sql
DELETE FROM reminders WHERE user_id=$1;
DELETE FROM envelope_transactions WHERE envelope_id IN (SELECT id FROM envelopes WHERE user_id=$1);
DELETE FROM loan_transactions WHERE loan_id IN (SELECT id FROM loans WHERE user_id=$1);
DELETE FROM documents WHERE user_id=$1;
DELETE FROM prescriptions WHERE user_id=$1;
DELETE FROM medications WHERE user_id=$1;
DELETE FROM appointments WHERE user_id=$1;
DELETE FROM salary_archives WHERE user_id=$1;
DELETE FROM recurring_entries WHERE user_id=$1;
DELETE FROM loans WHERE user_id=$1;
DELETE FROM envelopes WHERE user_id=$1;
DELETE FROM bank_accounts WHERE user_id=$1;
DELETE FROM patients WHERE user_id=$1;
DELETE FROM practitioners WHERE user_id=$1;
-- pas de table `members` séparée : member_id dans budget pointe sur patients.id
-- users.demo conservé : on re-seed dans le même compte
```

### RNG seedé

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
```

12 lignes, pas de dépendance, déterministe.

## Cron de reset

### `backend/src/cron/demo-reset.ts`

Dépendance ajoutée : `node-cron` (~10 KB, 5M downloads/sem, zéro CVE récente).

```ts
import cron from 'node-cron';
import { runDemoReset } from '../scripts/seed-demo/index.js';

export function startDemoResetCron() {
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

Wired dans `backend/src/index.ts` après `serve()`.

### Scripts package.json (backend)

```json
"seed:demo": "tsx src/scripts/seed-demo.ts",
"seed:demo:reset": "tsx src/scripts/seed-demo.ts --reset"
```

## Tests

| Type | Fichier | Couverture |
|---|---|---|
| Unit | `seed-demo/rng.spec.ts` | 2 runs avec même seed = mêmes valeurs |
| Unit | `seed-demo/builders/budget.spec.ts` | Cohérence soldes : sum(envelope_transactions) = envelope.balance |
| Unit | `seed-demo/builders/medical.spec.ts` | RDV pédiatre uniquement pour patients < 18 ans |
| Integration | `seed-demo/index.spec.ts` | Run complet sur DB test : ~100 entités, FK valides, idempotent (run × 2 = même état) |
| Integration | `routes/auth.demo.spec.ts` | `POST /auth/demo-login` : 200 si `DEMO_ENABLED=true`, 403 sinon |
| Frontend (Vitest) | `auth.store.spec.ts` | `demoLogin()` set user · `needsEncryptionSetup === false` quand `isDemoAccount=true` |

Pas de test pour le cron lui-même (juste vérifier que `startDemoResetCron` ne throw pas si `DEMO_ENABLED=false`).

## I18n — clés Transloco

```json
// src/assets/i18n/fr.json
{
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
}

// src/assets/i18n/en.json
{
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
}
```

## Sécurité

- `DEMO_ENABLED` doit être set explicitement à `'true'` → la prod régulière (self-hosters) n'expose pas la démo par défaut.
- `/auth/demo-login` est rate-limité (10/min/IP) → protège contre le flood JWT.
- L'email `demo@dashflow.app` est blacklisté dans `/auth/register` → pas de squat.
- Le bypass `needsEncryptionSetup` / `needsUnlock` est strictement gaté par `isDemoAccount` côté frontend ET le user ne peut pas auto-set ce flag (pas exposé dans une API).
- Pas de mot de passe public partagé : le visiteur n'a jamais à connaître le password — il passe par `/auth/demo-login` qui retourne un JWT direct.

## Déploiement

```bash
# 1. Migration DB
cd backend && pnpm db:generate && pnpm db:migrate

# 2. Init compte démo (1 fois)
DEMO_ENABLED=true pnpm seed:demo

# 3. Activer en prod (.env)
echo 'DEMO_ENABLED=true' >> .env

# 4. Restart backend (cron démarre auto)
```

Variables d'env à documenter dans `backend/.env.example` :

```bash
DEMO_ENABLED=false  # passer à 'true' pour activer le compte démo public
```

### Suivi runtime

- `[cron] Demo reset planifié (toutes les 6h)` au boot
- `[cron] Reset démo OK` toutes les 6h
- `[auth] Demo login from <ip>` à chaque clic

### Métriques pour le launch day

- Comptage des hits `/auth/demo-login` (grep logs Hono)
- Taille DB du compte demo après reset (devrait rester ~100 lignes, sinon le wipe a un bug)

### Rollback

1. `DEMO_ENABLED=false` → désactive cron + endpoint
2. Le compte démo reste en DB mais inaccessible
3. `DELETE FROM users WHERE is_demo_account = true CASCADE` si nettoyage nécessaire
