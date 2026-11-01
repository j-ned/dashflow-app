# Pipeline de migrations Drizzle — Design

> Date : 2026-06-02 · Repo : `nest-dashflow-app` (backend NestJS) · Statut : approuvé (design)

## Problème

Le backend n'a **aucun historique de migrations**. La base (dev **et** prod) provient d'un **dump prod restauré** : toutes les tables existent déjà, avec l'ancien journal Hono (`drizzle.__drizzle_migrations`), mais rien pour Nest. Conséquences :

- Les changements de schéma (ex. `bank_accounts.type`, `loan_transactions.note`) sont aujourd'hui appliqués à la main par `ALTER TABLE`, sans versionnement ni reproductibilité.
- Risque déjà rencontré : une `drizzle-kit migrate` au boot qui échoue → **502 masqué** (spinner) + fausse erreur CORS.

`drizzle.config.ts` est déjà prêt (out `./src/db/migrations`, journal séparé `__drizzle_migrations_nest` dans le schéma `drizzle`). Le `Dockerfile` pose déjà le principe « pas de migration au boot, étape séparée ».

## Objectifs

- Pipeline de migrations versionnées, reproductibles, commitées.
- **Adopter** les migrations sur les DB existantes sans recréer les tables.
- Application des migrations en **étape pré-déploiement séparée** (jamais au boot).
- Garde-fous contre le 502 et les pièges connus (DROP non idempotent, migration non commitée).

## Non-objectifs

- Pas de migration au boot de l'app (décision actée, Dockerfile inchangé).
- Pas de réécriture du schéma TS (il reste la source de vérité ; on **ne** fait **pas** de `drizzle-kit pull`).
- Pas de refonte du flux de dump/restore dev (`make db-*` inchangé).

## Approche retenue : baseline « generate + mark-applied »

1. Générer une migration **baseline `0000`** (CREATE complet) depuis le schéma TS actuel.
2. Sur les DB **existantes** (dev + prod), inscrire `0000` comme **déjà appliquée** dans `drizzle.__drizzle_migrations_nest`, **sans exécuter le SQL**.
3. Sur une DB **neuve** (futur, CI, nouvel environnement), `db:migrate` joue `0000` normalement (CREATE complet) puis les migrations suivantes.

Rejetées : `drizzle-kit pull` (écrase le schéma TS) ; repartir de zéro via `push` (pas de versionnement).

## Composants

### 1. Scripts `package.json`

| Script | Commande | Rôle |
|---|---|---|
| `db:generate` | `drizzle-kit generate` | Créer une migration depuis un changement de schéma |
| `db:migrate` | `drizzle-kit migrate` | Appliquer les migrations en attente (dev + étape déploiement) |
| `db:check` | `drizzle-kit check` | Valider la cohérence des migrations (garde CI / pré-migrate) |
| `db:baseline` | `tsx scripts/db/baseline.ts` | Marquer la baseline comme appliquée sur une DB existante (one-shot, idempotent) |

### 2. Migration baseline `src/db/migrations/0000_*.sql` (+ `meta/_journal.json`, snapshot)

Générée, **commitée**. C'est l'état de départ versionné.

### 3. `scripts/db/baseline.ts`

Script one-shot, **idempotent**, qui :

- `CREATE SCHEMA IF NOT EXISTS drizzle;`
- `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations_nest (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);`
- Lit `meta/_journal.json` + chaque `.sql`, calcule le **hash exactement comme le migrateur drizzle-orm** (sha256 du contenu SQL), et **insère** l'entrée du journal **si absente** (pas de réexécution du SQL).
- Cible `process.env.DATABASE_URL`.

Effet : `db:migrate` voit `0000` comme appliquée → la saute → applique uniquement les migrations suivantes.

### 4. Déploiement (étape séparée)

- Runbook : lancer `pnpm db:check && pnpm db:migrate` (avec `DATABASE_URL` prod) **avant** de déployer le nouveau backend — manuellement ou via un hook pré-deploy Dokploy.
- `db:migrate` échoue **bruyamment** (exit ≠ 0) : si la migration casse, on **ne déploie pas**. L'erreur n'est jamais masquée par le boot.
- Le boot reste sans migration (`Dockerfile` inchangé).

## Garde-fous (pièges connus)

- Migrations rejouables : `DROP ... IF EXISTS`, `ADD COLUMN IF NOT EXISTS` quand pertinent.
- **Toujours commiter** la migration avant de la jouer en prod (jamais de migration non commitée appliquée).
- `db:check` exécuté avant `db:migrate`.
- `baseline.ts` idempotent (relançable sans effet de bord).

## Vérification de parité (avant de marquer la baseline)

Avant le `db:baseline` sur une DB existante, s'assurer que le schéma TS correspond bien au dump :

- `pnpm db:check` (cohérence des fichiers de migration).
- Comparaison du snapshot baseline vs DB réelle (introspection `drizzle-kit pull` dans un dossier temporaire **jeté ensuite**, diff manuel). Si dérive détectée (colonne dans le schéma absente en base, ou inverse) → **corriger la dérive d'abord** (ALTER ciblé) avant de baseliner.

## Répartition des tâches (prudence prod)

- **Claude livre** : scripts `package.json`, `scripts/db/baseline.ts`, migration `0000` générée, runbook (`docs/`), et exécute la baseline + migrate sur **dev** si la Postgres Podman est démarrée.
- **L'utilisateur exécute** les étapes touchant la **prod** : `db:baseline` (marquage) puis le 1er `db:migrate`, et l'intégration au déploiement Dokploy. Claude ne touche jamais la prod directement (cf. règle DB prod).

## Vérification / critères de succès

- Dev : après `db:generate` (baseline) + `db:baseline`, un `db:migrate` ne fait **rien** (DB déjà à jour) et ne casse pas.
- Un changement de schéma test (ex. colonne factice) → `db:generate` produit `0001` → `db:migrate` l'applique proprement → rollback de la colonne de test.
- `db:check` passe.
- Build + tests backend toujours verts.

## Rollback

- La baseline n'exécute aucun DDL sur les DB existantes (juste une ligne de journal) → pas de risque de modification de schéma.
- En cas d'erreur de marquage : supprimer la ligne insérée dans `__drizzle_migrations_nest` (le script est idempotent et ré-exécutable).
