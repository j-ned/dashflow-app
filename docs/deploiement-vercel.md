# Déploiement sur Vercel

Un seul projet Vercel, construit à partir de `vercel.json` à la racine du dépôt, contient deux services (fonctionnalité *Services*, en bêta sur tous les plans) :

| Chemin public | Service | Contenu |
|---|---|---|
| `/api/*` | `api` | API Hono (`apps/api/src/vercel.ts`), exécutée en fonctions Vercel à **Francfort** (`fra1`) |
| tout le reste | `web` | SPA Angular statique (`apps/web`), avec les en-têtes de sécurité et de cache de `nginx.conf` |

Le front et l'API partagent la même origine : pas de CORS, cookie de session `SameSite=Lax`.

## Ce que Vercel impose (déjà intégré au code)

- **Requêtes plafonnées à 4,5 Mo :** les fichiers (documents, ordonnances, fiches de paie) sont limités à **4 Mo**, contre 10 auparavant, côté front comme côté API.
- **Plusieurs instances en parallèle :** la limitation de débit passe par **Redis (Upstash)**. L'API refuse de démarrer sur Vercel sans Redis.
- **Pas d'horloge interne :** les tâches de fond sont déclenchées par **Vercel Cron** via `/api/cron/*` (jeton `CRON_SECRET`). Sur le plan Hobby, chaque tâche ne peut tourner qu'**une fois par jour**, à une heure près. Le reset de la démo devient donc quotidien (03 h UTC) au lieu de toutes les 6 h. Sur le plan Pro, on peut revenir à `0 */6 * * *` dans `vercel.json`.
- **Connexions Postgres limitées :** 3 connexions par instance, sans requêtes préparées, ce qui est compatible avec le pooler Neon.

## 1. Créer le projet

1. Sur vercel.com → *Add New… → Project* → importe `j-ned/dashflow-app`.
2. **Root Directory** : la racine du dépôt (ne choisis pas `apps/web`). `vercel.json` décrit les services.
3. Ne lance pas encore de déploiement « pour voir » : sans les variables, l'API refusera de démarrer, ce qui est voulu.

## 2. Base de données : Neon, région Francfort

Dans le projet, onglet *Storage* (ou Marketplace) → **Neon** → crée une base dans la région **AWS eu-central-1 (Frankfurt)**, comme les fonctions. Ce sont des données de santé : elles restent en UE.

L'intégration injecte `DATABASE_URL` (connexion poolée, utilisée par l'API) et `DATABASE_URL_UNPOOLED` (connexion directe, pour les migrations et l'import).

## 3. Redis : Upstash, région Francfort

*Storage* → **Upstash for Redis**, région **eu-central-1**. L'intégration injecte `KV_REST_API_URL` et `KV_REST_API_TOKEN`, que l'API lit directement.

## 4. Variables d'environnement (Production)

> ⚠️ **Recopie les valeurs de la prod actuelle, sans en générer de nouvelles.**
> `TOTP_ENC_KEY` chiffre les secrets 2FA en base. S'il n'est pas défini en prod, ils sont chiffrés avec une clé dérivée de `JWT_SECRET`. Une valeur différente rend la 2FA de tous les comptes inutilisable et déconnecte tout le monde.

| Variable | Valeur |
|---|---|
| `NODE_ENV` | `production` |
| `JWT_SECRET`, `TOTP_ENC_KEY` | **celles de la prod actuelle** (Dokploy) |
| `CORS_ORIGIN` | `https://dashflow.nedellec-julien.fr` (origine du front : contrôle CSRF, liens des mails) |
| `APP_URL` | `https://dashflow.nedellec-julien.fr/api` |
| `CRON_SECRET` | **nouvelle** valeur : `openssl rand -hex 32` |
| `MAILER`, `SMTP_*` | celles de la prod actuelle (`MAILER=smtp`) |
| `S3_*` | celles de la prod actuelle (Cloudflare R2) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | celles de la prod actuelle |
| `SENTRY_DSN`, `HEALTH_TOKEN`, `DEMO_ENABLED` | celles de la prod actuelle |

`DATABASE_URL`, `KV_REST_API_*` et `VERCEL` sont posées automatiquement par les intégrations et la plateforme.

## 5. Copier les données (fenêtre de maintenance)

L'ancienne API doit être arrêtée (ou au moins ne plus recevoir d'écritures) pendant la copie. Sinon, tout ce qui est écrit entre l'export et la bascule DNS est perdu.

```bash
# 1. Export depuis le VPS (format custom, sans propriétaires/droits propres à l'ancien serveur)
pg_dump --format=custom --no-owner --no-acl "$ANCIENNE_DATABASE_URL" > dashflow.dump

# 2. Import dans Neon (connexion DIRECTE, pas le pooler)
pg_restore --no-owner --no-acl --dbname="$DATABASE_URL_UNPOOLED" dashflow.dump

# 3. Migrations éventuellement en attente
DATABASE_URL="$DATABASE_URL_UNPOOLED" pnpm --filter @dashflow/api db:migrate
```

Vérifie ensuite que les deux bases ont le même nombre de lignes, par exemple sur `users`, `account_transactions` et `documents`. Les fichiers restent dans R2 : rien à copier de ce côté.

## 6. Premier déploiement et tests sur l'URL `*.vercel.app`

1. **Ouvrir l'URL de test au CSRF :** ajoute temporairement l'URL du déploiement à `CORS_ORIGIN`, par exemple `https://dashflow-app-xxx.vercel.app,https://dashflow.nedellec-julien.fr`, sinon le contrôle CSRF refuse les mutations.
2. **Vérifier la santé de l'API :**

   ```bash
   curl -si https://<url>.vercel.app/api/health
   ```

   Réponse attendue : `200 {"ok":true}`.
3. **Parcourir l'application :** connexion avec mot de passe, avec 2FA, et avec Google (après l'étape 7) ; envoi d'un document de moins de 4 Mo ; déconnexion.
4. **Vérifier les crons :** *Settings → Cron Jobs* doit lister 3 tâches. Lance-en une manuellement et vérifie qu'elle répond 200.

## 7. OAuth Google

Console Google Cloud → client OAuth → *URI de redirection autorisés* → ajoute `https://dashflow.nedellec-julien.fr/api/auth/oauth/google/callback`.

## 8. Basculer le domaine

1. Vercel → *Settings → Domains* → ajoute `dashflow.nedellec-julien.fr`.
2. Chez ton registrar, fais pointer `dashflow` vers Vercel avec l'enregistrement qu'indique Vercel (`CNAME` vers `cname.vercel-dns.com` en général).
3. Une fois le certificat émis, retire l'URL `*.vercel.app` de `CORS_ORIGIN` et redéploie.

## Retour arrière

- **Rétablir le DNS :** remets l'enregistrement `dashflow` vers le VPS. L'ancienne pile Dokploy reste intacte tant que tu ne l'as pas supprimée.
- **Données écrites entre-temps :** celles écrites sur Neon après la bascule ne sont pas sur l'ancienne base. Garde le VPS en lecture seule tant que la prod Vercel n'est pas validée.
