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

## L'image de prod est autonome
L'image Docker embarque `scripts/db/*.mjs` + `src/db/migrations/` et utilise le **migrateur programmatique de drizzle-orm** (dép de prod, pas de drizzle-kit dans l'image). Donc, depuis le conteneur déployé (le `DATABASE_URL` prod y est déjà injecté) :
- Appliquer les migrations : `node scripts/db/migrate.mjs`
- Marquer une baseline : `node scripts/db/baseline.mjs`
Le **boot ne migre jamais** (`CMD = node dist/main`).

## Déploiement (automatique au démarrage du conteneur)
Dokploy (type Application) n'a pas de champ « pre-deploy command ». La migration est donc
intégrée au **`CMD` de l'image** :
```
sh -c "node /app/scripts/db/migrate.mjs && exec node dist/main"
```
- Au démarrage, le conteneur **migre puis lance l'app** (`DATABASE_URL` injecté par Dokploy).
- Fail-fast : si la migration échoue, le `&&` stoppe → crash-loop → erreur visible dans les logs (pas de 502 silencieux). Sûr car **1 réplica** (pas de course Swarm).
- Chemin des migrations résolu relativement au script → indépendant du CWD.

Repli manuel : `docker exec <conteneur-backend> node /app/scripts/db/migrate.mjs`
(ou local/CI : `DATABASE_URL="<url-prod>" pnpm db:migrate`).

## Première adoption en PROD (une seule fois, AVANT le 1er déploiement de l'image entrypoint)
La base de prod contient déjà le schéma (dump). Comme le `CMD` migre au démarrage, si `0000`
n'est pas marquée, le conteneur tentera de recréer les tables → crash-loop. Il faut donc marquer
`0000` **en SQL directement** (l'ancienne image n'a pas encore `scripts/`), via `ssh homeserver`
puis psql dans le conteneur Postgres de prod :
```sql
CREATE SCHEMA IF NOT EXISTS drizzle;
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations_nest (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint);
INSERT INTO drizzle.__drizzle_migrations_nest (hash, created_at)
SELECT 'dbfd033cb02fe5d8226863251017435e685c51755d17485b3547809f1335468a', 1780426484929
WHERE NOT EXISTS (SELECT 1 FROM drizzle.__drizzle_migrations_nest WHERE hash = 'dbfd033cb02fe5d8226863251017435e685c51755d17485b3547809f1335468a');
```
Ensuite, au déploiement, l'entrypoint saute `0000` et applique seulement les diffs (`0001`+).
Le hash ci-dessus = celui du `0000` actuel ; s'il est régénéré, relire via `pnpm db:baseline` sur dev.

## Pièges
- `DROP ... IF EXISTS` / `ADD COLUMN IF NOT EXISTS` dans les migrations sensibles.
- Toujours commiter avant de jouer en prod.
- Le boot ne migre jamais (évite le 502 masqué).
- Ne jamais `make db-restore` par-dessus la prod.
