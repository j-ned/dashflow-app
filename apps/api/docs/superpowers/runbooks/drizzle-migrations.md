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

## Déploiement (étape séparée — JAMAIS au boot)
1. Migrations commitées et présentes dans l'image (build).
2. **Avant** de basculer le trafic, lancer la migration dans le conteneur (étape release/pre-deploy Dokploy), p. ex. :
   `docker exec <conteneur-backend> node scripts/db/migrate.mjs`
   (ou en CI/local : `DATABASE_URL="<url-prod>" pnpm db:migrate`)
3. La migration doit finir en exit 0. **Si elle échoue : NE PAS basculer** (sinon 502).
4. Déployer/redémarrer le backend.

## Première adoption en PROD (une seule fois)
La base de prod contient déjà le schéma (dump) → marquer `0000` comme appliquée sans la rejouer :
- Depuis le conteneur backend : `node scripts/db/baseline.mjs`
- OU directement en SQL sur la base (si le conteneur n'est pas encore déployé) :
  `INSERT INTO drizzle.__drizzle_migrations_nest (hash, created_at)` avec le hash de `0000` (cf. `pnpm db:baseline` sur dev pour relire le hash) `WHERE NOT EXISTS (...)`.
- Ensuite, les `migrate` suivants n'appliquent que les diffs.

## Pièges
- `DROP ... IF EXISTS` / `ADD COLUMN IF NOT EXISTS` dans les migrations sensibles.
- Toujours commiter avant de jouer en prod.
- Le boot ne migre jamais (évite le 502 masqué).
- Ne jamais `make db-restore` par-dessus la prod.
