# Pipeline de migrations Drizzle — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> ⚠️ **Règle J-Ned : ne JAMAIS exécuter `git add` / `git commit`.** Chaque étape « Commit » = **proposer** le message ; l'utilisateur committe lui-même.
> ⚠️ **Prod : Claude ne touche jamais la DB prod.** Les étapes marquées « PROD (utilisateur) » sont exécutées par l'utilisateur.

**Goal:** Mettre en place un pipeline de migrations Drizzle versionnées, appliquées en étape séparée pré-déploiement, adopté sur une base existante via une baseline marquée « déjà appliquée ».

**Architecture:** Baseline `0000` générée depuis le schéma TS (source de vérité) ; sur les bases existantes (dev + prod), un script idempotent l'inscrit dans le journal `drizzle.__drizzle_migrations_nest` sans exécuter le SQL ; les migrations futures sont des diffs appliqués par `drizzle-kit migrate` avant chaque déploiement. Le boot ne migre jamais.

**Tech Stack:** drizzle-kit 0.31, drizzle-orm 0.44 (`readMigrationFiles`), postgres-js, Node 22 (`--env-file-if-exists`), pnpm.

---

## Fichiers

- **Modifier** `package.json` — ajouter les scripts `db:generate`, `db:migrate`, `db:check`, `db:baseline`.
- **Créer** `src/db/migrations/0000_*.sql` + `src/db/migrations/meta/{_journal.json,0000_snapshot.json}` — baseline générée.
- **Créer** `scripts/db/baseline.mjs` — marquage idempotent de la baseline comme appliquée.
- **Créer** `docs/superpowers/runbooks/drizzle-migrations.md` — procédure dev + déploiement + prod.

Pré-requis : `drizzle.config.ts` existe déjà (out `./src/db/migrations`, journal `__drizzle_migrations_nest` / schéma `drizzle`). Ne pas le modifier.

---

### Task 1 : Scripts npm

**Files:**
- Modify: `package.json` (bloc `"scripts"`)

- [ ] **Step 1 : Ajouter les 4 scripts**

Dans `package.json`, ajouter au bloc `"scripts"` (après `"start:prod"`) :

```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:check": "drizzle-kit check",
    "db:baseline": "node --env-file-if-exists=.env scripts/db/baseline.mjs"
```

- [ ] **Step 2 : Vérifier que drizzle-kit répond**

Run: `pnpm db:check`
Expected: la commande s'exécute sans erreur de config (peut afficher « Everything's fine » ou rien si aucune migration ; pas de stacktrace). Une erreur de connexion DB est acceptable ici si la DB est down — l'important est que le binaire et la config se chargent.

- [ ] **Step 3 : Commit (proposer — l'utilisateur committe)**

Message : `chore(db): ajoute les scripts de pipeline de migrations Drizzle`

---

### Task 2 : Générer la migration baseline

**Files:**
- Create: `src/db/migrations/0000_*.sql`, `src/db/migrations/meta/_journal.json`, `src/db/migrations/meta/0000_snapshot.json`

- [ ] **Step 1 : Générer depuis le schéma (ne touche PAS la DB)**

Run: `pnpm db:generate`
Expected: création d'un fichier `src/db/migrations/0000_<nom>.sql` + dossier `meta/` avec `_journal.json` et `0000_snapshot.json`. Sortie type « Your SQL migration file ➜ src/db/migrations/0000_….sql 🚀 ».

- [ ] **Step 2 : Vérifier le contenu de la baseline**

Run: `grep -c "CREATE TABLE" src/db/migrations/0000_*.sql`
Expected: un nombre ≥ au nombre de tables du schéma (auth + medical + finance + shared). Vérifier aussi la présence des enums :
Run: `grep -E "CREATE TYPE|envelope_type|loan_direction|recurring_entry_type" src/db/migrations/0000_*.sql | head`
Expected: les `CREATE TYPE` des enums apparaissent.

- [ ] **Step 3 : Vérifier la cohérence**

Run: `pnpm db:check`
Expected: aucune erreur de cohérence des migrations.

- [ ] **Step 4 : Commit (proposer — l'utilisateur committe)**

Message : `chore(db): baseline 0000 (schéma actuel)`
⚠️ La baseline DOIT être commitée avant tout `db:migrate` en prod (règle anti-piège : jamais de migration non commitée jouée).

---

### Task 3 : Script de marquage de baseline

**Files:**
- Create: `scripts/db/baseline.mjs`

- [ ] **Step 1 : Écrire le script**

Créer `scripts/db/baseline.mjs` avec ce contenu exact :

```js
// Marque les migrations présentes comme DÉJÀ APPLIQUÉES sur une base qui contient
// déjà le schéma (dump prod restauré), SANS exécuter leur SQL. Idempotent.
//
// Dev  : pnpm db:baseline                (charge .env si présent)
// Prod : DATABASE_URL=... node scripts/db/baseline.mjs   (env injecté par Dokploy)
import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant.');
  process.exit(1);
}

const MIGRATIONS_FOLDER = 'src/db/migrations';
const SCHEMA = 'drizzle';
const TABLE = '__drizzle_migrations_nest';

const migrations = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });
if (migrations.length === 0) {
  console.error(`Aucune migration dans ${MIGRATIONS_FOLDER}. Lance d'abord "pnpm db:generate".`);
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
  await sql.unsafe(
    `CREATE TABLE IF NOT EXISTS "${SCHEMA}"."${TABLE}" (
       id SERIAL PRIMARY KEY,
       hash text NOT NULL,
       created_at bigint
     )`,
  );

  let inserted = 0;
  for (const migration of migrations) {
    const existing = await sql`
      SELECT 1 FROM ${sql(SCHEMA)}.${sql(TABLE)} WHERE hash = ${migration.hash} LIMIT 1`;
    if (existing.length > 0) {
      console.log(`= déjà marquée : ${migration.hash.slice(0, 12)}…`);
      continue;
    }
    await sql`
      INSERT INTO ${sql(SCHEMA)}.${sql(TABLE)} (hash, created_at)
      VALUES (${migration.hash}, ${migration.folderMillis})`;
    inserted += 1;
    console.log(`+ marquée appliquée : ${migration.hash.slice(0, 12)}…`);
  }
  console.log(`Terminé : ${inserted} marquée(s), ${migrations.length - inserted} déjà présente(s).`);
} finally {
  await sql.end();
}
```

Note : on réutilise `readMigrationFiles` de drizzle-orm → le `hash` et `folderMillis` sont **identiques** à ce que `drizzle-kit migrate` calcule, donc la migration est reconnue comme appliquée et **n'est jamais rejouée**.

- [ ] **Step 2 : Vérifier la syntaxe (sans DB)**

Run: `node --check scripts/db/baseline.mjs`
Expected: aucune sortie (syntaxe valide).

- [ ] **Step 3 : Commit (proposer — l'utilisateur committe)**

Message : `chore(db): script de marquage de baseline (adoption DB existante)`

---

### Task 4 : Adoption sur la DB de dev + preuve

⚠️ Nécessite la Postgres Podman locale démarrée. Si elle n'est pas accessible, ces étapes sont à exécuter par l'utilisateur.

**Files:** aucun (opérations DB de dev, lecture/journal uniquement)

- [ ] **Step 1 : Démarrer la DB de dev**

Run: `make db-up`
Expected: conteneur Postgres up (au 1er boot, restauration auto du dump).

- [ ] **Step 2 : Vérification de parité schéma ⟷ DB (lecture seule)**

Introspecter la DB réelle dans un dossier jetable et comparer aux tables du schéma :
Run: `pnpm exec drizzle-kit pull --out=/tmp/drizzle-parity 2>&1 | tail -5 && grep -c "pgTable" /tmp/drizzle-parity/schema.ts`
Expected: l'introspection réussit ; le nombre de `pgTable` introspectés correspond aux tables du schéma `src/db/schema/`. **Inspecter** `/tmp/drizzle-parity/schema.ts` pour toute colonne présente dans `src/db/schema` mais absente en base (ou inverse) — en particulier les colonnes ajoutées par `ALTER` ad-hoc. En cas de dérive : corriger d'abord (ALTER ciblé sur dev) **avant** l'étape 3. Puis : `rm -rf /tmp/drizzle-parity`.

- [ ] **Step 3 : Marquer la baseline comme appliquée**

Run: `pnpm db:baseline`
Expected: `+ marquée appliquée : <hash>…` puis `Terminé : 1 marquée(s), 0 déjà présente(s).`

- [ ] **Step 4 : PREUVE — migrate ne fait rien (adoption réussie)**

Run: `pnpm db:migrate`
Expected: aucune migration jouée (sortie type « No migrations to apply » / aucune création de table). **Si** migrate tente de créer des tables → la baseline n'a pas été reconnue : STOP, ne pas continuer, investiguer.

- [ ] **Step 5 : Idempotence**

Run: `pnpm db:baseline`
Expected: `= déjà marquée : <hash>…` puis `Terminé : 0 marquée(s), 1 déjà présente(s).`

---

### Task 5 : Test de bout en bout du cycle (changement de schéma jetable)

Prouve que les **futurs** changements passent proprement. DB de dev requise.

**Files:**
- Modify (temporaire) : `src/db/schema/finance.ts`
- Create (temporaire, puis supprimé) : `src/db/migrations/0001_*.sql`

- [ ] **Step 1 : Ajouter une colonne jetable au schéma**

Dans `src/db/schema/finance.ts`, sur la table `bankAccounts`, ajouter temporairement une colonne :

```ts
  migrationSmokeTest: varchar('migration_smoke_test', { length: 8 }),
```

(Vérifier que `varchar` est déjà importé dans le fichier ; il l'est.)

- [ ] **Step 2 : Générer la migration de diff**

Run: `pnpm db:generate`
Expected: création de `src/db/migrations/0001_*.sql` contenant `ALTER TABLE "bank_accounts" ADD COLUMN "migration_smoke_test"`.

- [ ] **Step 3 : Appliquer**

Run: `pnpm db:migrate`
Expected: `0001` appliquée (1 migration jouée). Vérifier la présence de la colonne en base :
Run: `podman compose -f compose.dev.yaml exec -T db psql -U djoudj -d dashflow_db -tAc "SELECT column_name FROM information_schema.columns WHERE table_name='bank_accounts' AND column_name='migration_smoke_test';"`
Expected: `migration_smoke_test`

- [ ] **Step 4 : Nettoyer — revert schéma + supprimer 0001 + colonne DB**

1. Retirer la ligne `migrationSmokeTest` de `src/db/schema/finance.ts`.
2. Supprimer la migration de test :
   Run: `rm src/db/migrations/0001_*.sql`
3. Retirer l'entrée `0001` de `src/db/migrations/meta/_journal.json` (éditer le tableau `entries` pour ne garder que l'idx 0) et supprimer `src/db/migrations/meta/0001_snapshot.json` :
   Run: `rm -f src/db/migrations/meta/0001_snapshot.json`
4. Supprimer la colonne + son entrée de journal en base :
   Run: `podman compose -f compose.dev.yaml exec -T db psql -U djoudj -d dashflow_db -c "ALTER TABLE bank_accounts DROP COLUMN IF EXISTS migration_smoke_test;"`

- [ ] **Step 5 : Vérifier le retour à l'état baseline**

Run: `pnpm db:check && pnpm db:generate`
Expected: `db:check` OK et `db:generate` ne crée **aucune** nouvelle migration (« No schema changes, nothing to migrate »). Si une migration est créée → le revert du schéma/journal est incomplet, recommencer le nettoyage.

- [ ] **Step 6 : Pas de commit** (rien ne doit subsister de ce test).

---

### Task 6 : Runbook de déploiement

**Files:**
- Create: `docs/superpowers/runbooks/drizzle-migrations.md`

- [ ] **Step 1 : Écrire le runbook**

Créer `docs/superpowers/runbooks/drizzle-migrations.md` :

```markdown
# Runbook — Migrations Drizzle

## Cycle de dev (changement de schéma)
1. Modifier le schéma dans `src/db/schema/*.ts`.
2. `pnpm db:generate` → crée `NNNN_*.sql` + snapshot.
3. `pnpm db:check` (cohérence).
4. `pnpm db:migrate` (applique sur la DB de dev locale).
5. **Commiter** la migration générée (jamais de migration non commitée jouée en prod).

## Adoption d'une base existante (1ʳᵉ fois, ou nouvel environnement avec dump)
- `pnpm db:baseline` marque la/les migration(s) présente(s) comme appliquée(s) sans rejouer le SQL.
- Idempotent : relançable sans effet.

## Déploiement (étape séparée — JAMAIS au boot)
Avant de déployer le nouveau backend :
1. S'assurer que les migrations sont commitées et présentes dans l'image/le checkout.
2. Lancer, pointé sur la prod :
   `pnpm db:check`
   `DATABASE_URL="<url-prod>" pnpm db:migrate`
3. Le migrate doit finir en exit 0. **S'il échoue : NE PAS déployer** (sinon 502 au boot).
4. Déployer le backend (le boot ne migre pas — Dockerfile inchangé).

## Première adoption en PROD (à faire une seule fois)
1. Vérifier que la baseline `0000` est bien celle correspondant au schéma déployé en prod.
2. `DATABASE_URL="<url-prod>" node scripts/db/baseline.mjs`
3. Ensuite seulement, les `db:migrate` suivants appliqueront les diffs.

## Pièges
- `DROP ... IF EXISTS` / `ADD COLUMN IF NOT EXISTS` dans les migrations sensibles.
- Toujours commiter avant de jouer en prod.
- Le boot ne migre jamais (évite le 502 masqué).
- Ne jamais `make db-restore` par-dessus la prod.
```

- [ ] **Step 2 : Commit (proposer — l'utilisateur committe)**

Message : `docs(db): runbook du pipeline de migrations Drizzle`

---

## PROD (utilisateur) — hors plan automatisé

Après validation en dev, l'utilisateur exécute, une seule fois, contre la prod :
1. `DATABASE_URL="<prod>" node scripts/db/baseline.mjs` (marque `0000` appliquée).
2. Intègre `pnpm db:check && pnpm db:migrate` comme étape pré-déploiement Dokploy.

---

## Self-review (rempli par l'auteur du plan)

- **Couverture spec :** baseline generate+mark (T2, T3, T4) ✓ ; scripts dev (T1) ✓ ; étape déploiement séparée (T6) ✓ ; garde-fous 502/commit (T2.4, T6) ✓ ; parité (T4.2) ✓ ; répartition dev/prod (T4 note, section PROD) ✓ ; vérif cycle complet (T5) ✓.
- **Placeholders :** aucun ; code complet pour `baseline.mjs` et le runbook.
- **Cohérence des noms :** table `__drizzle_migrations_nest` / schéma `drizzle` alignés avec `drizzle.config.ts` ; dossier `src/db/migrations` aligné avec `out`.
```
