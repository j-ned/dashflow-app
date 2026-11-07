# Previews Vercel isolées de la production

Une preview (`VERCEL_ENV=preview` : toute branche autre que `master`) ne doit jamais toucher aux
données ni aux secrets de production. Elle tourne sur la branche Neon `preview` (schéma + seed de
démo, **jamais de copie de prod**) avec ses propres secrets, et n'envoie aucun email.

## Ce que fait le code (sans configuration)

Le code distingue la preview de la production par `VERCEL_ENV`, posé par Vercel lui-même, et non
par `NODE_ENV` (Vercel peut poser `NODE_ENV=production` sur une preview) ni par une variable du
projet (une variable oubliée ou mal ciblée suffirait à faire partir de vrais emails).
Cf. `deploymentTier()` dans `apps/api/src/config/env.schema.ts`.

| Sujet | Production (`VERCEL_ENV=production`, ou Docker avec `NODE_ENV=production`) | Preview (`VERCEL_ENV=preview`) |
|---|---|---|
| Démarrage | Exige Redis (`KV_REST_API_*`), `CRON_SECRET`, `MAILER=smtp` + `SMTP_HOST`, un `JWT_SECRET` non-exemple. Désormais exigé aussi si `NODE_ENV` manque sur la prod Vercel | Exige seulement `DATABASE_URL` et `JWT_SECRET` (non-exemple), même si `NODE_ENV=production` |
| Emails | SMTP | **Aucun envoi**, quel que soit `MAILER`. Log : destinataire masqué (`j***@example.com`) + sujet. **Jamais de code OTP, de lien ni d'adresse complète** |
| Cookies de session | `Secure`, préfixe `__Host-` | Idem (servie en HTTPS) |
| CSRF (en-tête `Origin`) | Origines de `CORS_ORIGIN` uniquement ; `Origin` absente refusée | `CORS_ORIGIN` + `https://$VERCEL_URL` et `https://$VERCEL_BRANCH_URL` (posées par Vercel) ; `Origin` absente refusée |
| Crons (`/api/cron/*`) | Vercel Cron + `CRON_SECRET` | Vercel ne lance pas les crons hors production ; sans `CRON_SECRET`, les routes répondent 404 |
| Throttling | Redis partagé (Upstash) | En mémoire, par instance, sans Redis configuré |
| Compte démo | Selon `DEMO_ENABLED` | `DEMO_ENABLED=true` : connexion démo et reset depuis l'app |
| Fichiers (S3/R2) | `S3_*` | Sans `S3_*` : envoi/lecture de fichiers → 503 « Stockage R2 non configuré » |
| Google OAuth | `GOOGLE_*` | Sans `GOOGLE_*` : le bouton Google échoue (500), connexion par le compte démo |

En local (`VERCEL_ENV` absent, `NODE_ENV` ≠ `production`), rien ne change : le mailer `console`
écrit toujours les codes dans le terminal de développement.

## Variables à créer en **Preview uniquement** (Vercel → Settings → Environment Variables)

| Nom | Valeur | Statut |
|---|---|---|
| `DATABASE_URL` | Chaîne de connexion **poolée** de la branche Neon `preview` | Obligatoire |
| `JWT_SECRET` | Nouveau secret : `openssl rand -base64 48` (jamais celui de prod : un jeton de prod ne doit pas être valide en preview, et inversement) | Obligatoire |
| `DEMO_ENABLED` | `true` (sans lui, aucune connexion possible : les inscriptions ne reçoivent pas leur code) | Obligatoire |
| `TOTP_ENC_KEY` | Nouvelle clé : `openssl rand -hex 32` (sinon dérivée du `JWT_SECRET` de preview, ce qui reste isolé de la prod) | Recommandée |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Seulement une base Upstash **dédiée** à la preview, pour un throttling partagé entre instances | Facultatif |
| `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_REGION` | Seulement pour tester les fichiers : bucket R2 dédié (`dashflow-preview`) et jeton R2 limité à ce bucket | Facultatif (absent = 503) |
| `CORS_ORIGIN` | Seulement si les variables système Vercel ne sont pas exposées (*Automatically expose System Environment Variables* décoché) : l'URL de la preview | Facultatif |

À ne **pas** créer en Preview : `MAILER`, `SMTP_*` (ignorées), `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `CRON_SECRET`, `SENTRY_DSN` (les événements seraient étiquetés
`production` si `NODE_ENV=production`), `HEALTH_TOKEN`, `APP_URL`, `NODE_ENV`.

## Cibles à régler sur les variables de production

- Intégration **Neon** : environnements reliés = **Production** seulement (famille `DATABASE_*`,
  `PG*`).
- Intégration **Upstash** (`KV_*`) : Production seulement.
- Variables du projet (`JWT_SECRET`, `TOTP_ENC_KEY`, `CRON_SECRET`, `SMTP_*`, `S3_*`,
  `GOOGLE_*`, `SENTRY_DSN`, `HEALTH_TOKEN`, `CORS_ORIGIN`, `APP_URL`, `NODE_ENV`) : cible
  Production seulement.

## Secret GitHub Actions

| Nom | Valeur | Effet |
|---|---|---|
| `PREVIEW_DATABASE_URL_UNPOOLED` | Chaîne **directe** (non poolée) de la branche Neon `preview` | Le job `preview-db` de la CI applique les migrations de chaque PR sur cette branche (`db:migrate`), après leur passage sur le Postgres jetable du job `api-e2e`. Sans le secret (forks, Dependabot), le job ne fait rien |

Une migration d'une PR non fusionnée reste appliquée sur la base de preview : en cas de conflit
entre deux PR, réinitialiser la base (étapes ci-dessous).

## Initialiser la base de preview (vide, sans donnée réelle)

1. Neon → *Branches* → *Create branch* `preview` **sans données** (« schema only »). Ne jamais
   partir d'une branche avec données : ce serait une copie de prod.
2. Une branche « schema only » a les tables mais pas l'historique Drizzle : vider le schéma
   avant d'initialiser, sinon la première migration échoue sur des tables existantes.

   ```sql
   DROP SCHEMA IF EXISTS drizzle CASCADE;
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   ```

3. Les rôles d'une branche Neon sont hérités de la branche parente : **régénérer le mot de passe
   du rôle** sur la branche `preview` (Neon → *Roles* → *Reset password*), sinon la chaîne de
   preview contient le mot de passe de prod.
4. Migrations + seed de démo :

   ```bash
   DATABASE_URL="<URL directe de la branche preview>" \
     pnpm --filter @dashflow/api db:init-preview
   ```

   La commande (`apps/api/src/db/preview-seed.ts`) :
   - **refuse** de tourner si `VERCEL_ENV=production`, et toute base qui contient un compte hors
     démo (production ou copie) — vérifié avant les migrations, puis à nouveau sous verrou ;
   - applique les migrations (même journal que `db:migrate`) ;
   - crée le compte démo `demo@demo.dashflow.test` (sans mot de passe : connexion par le bouton
     démo) et un foyer fictif (membres, praticien, rendez-vous, comptes, opérations, enveloppe) ;
   - fige ces données dans les tables `demo_seed_*` via `scripts/demo-seed-snapshot.sql`, le
     mécanisme du reset démo existant.

   Relançable : elle recrée les données de démo à l'identique. Elle ne lit pas `.env` : l'URL
   doit être passée explicitement.

## Ce qui reste désactivé en preview

- Envoi d'emails : inscription et mot de passe oublié n'aboutissent pas (code non journalisé).
  Utiliser le compte démo.
- Google OAuth, fichiers (sans bucket dédié), crons.

## Risques résiduels

- **Inscriptions sur la preview :** une inscription crée un compte non vérifié (le code n'est ni
  envoyé ni journalisé). Ce compte bloque ensuite `db:init-preview` ; réinitialiser la branche
  Neon (étape 2) puis relancer.
- **Throttling en mémoire** sans Redis dédié : contournable en répartissant les essais entre
  instances. Acceptable sur des données fictives ; ajouter un Upstash dédié sinon.
- **URL de preview publique** (sauf *Deployment Protection* Vercel) : le compte démo est partagé
  et réinitialisable par tous. Aucune donnée réelle n'y figure.
- **`VERCEL_URL` / `VERCEL_BRANCH_URL`** doivent être exposées au runtime (réglage Vercel par
  défaut). Sinon, les mutations de la preview sont refusées (« Origine non autorisée ») :
  définir `CORS_ORIGIN` en Preview.
- **Migrations de PR non fusionnées** appliquées à la base partagée de preview (voir ci-dessus).

## Retour arrière

Revert de la PR : la production retrouve exactement son comportement (elle n'en a pas changé,
hormis des garde-fous qui s'appliquent aussi quand `VERCEL_ENV=production` sans
`NODE_ENV=production`). Côté Vercel, remettre la cible Preview sur les variables de production
rétablirait les previews sur les données de prod : à éviter.
