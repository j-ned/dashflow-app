# Production sur le serveur (Dokploy)

La pile de production est `compose.yaml` :
- **`dashflow-web`** : nginx sert le front et relaie `/api/` vers l'API.
- **`dashflow-api`** : l'API Node. Elle applique ses migrations au démarrage et fait tourner ses tâches planifiées.
- **`dashflow-backup`** : sauvegarde quotidienne chiffrée de la base.

Les compteurs de limitation (connexions, envois de code) vivent dans un service **Redis** de Dokploy, lui aussi hors de la pile, partagé par toutes les instances de l'API. Il ne contient rien de précieux : le perdre remet seulement les compteurs à zéro.

La base Postgres 18 est **hors de la pile** : c'est le service de base de données `dashflow-db` de Dokploy, que l'API et la sauvegarde joignent par `dokploy-network`. Dokploy ne construit rien : il tire les images publiées sur GHCR par la CI (`dashflow-web`, `dashflow-api`, `dashflow-backup`). Le trafic arrive par le tunnel Cloudflare, puis passe par le Traefik de Dokploy.

Le domaine `dashflow.nedellec-julien.fr` est un _Public Hostname_ du tunnel Cloudflare du serveur, vers le Traefik de Dokploy.

## Mise en place (une fois)

1. **Paquets GHCR** : ils sont créés à la première publication depuis `master`. S'ils sont publics, rien à faire. S'ils sont privés, déclare `ghcr.io` dans les registres de Dokploy avec un jeton `read:packages`.
2. **Buckets** : il en faut deux, privés, chacun avec un jeton d'API limité à son bucket.
   - **Documents** : les fichiers envoyés par les utilisateurs (ordonnances, documents, avatars).
   - **Sauvegardes** : par exemple `dashflow-backups`, avec une règle de cycle de vie qui supprime les objets après la durée voulue (30 jours, par exemple).
3. **Dokploy** : dans le projet où se trouve `dashflow-db`, crée un service de type **Compose** dont la source est le dépôt.
   - Fournisseur **Git**, URL `https://github.com/j-ned/dashflow-app.git`, branche `master`.
   - Compose Path : `./deploy/compose.yaml`. La valeur par défaut, `./docker-compose.yml`, échoue avec « Compose file not found ».
   - **Auto Deploy désactivé** : c'est la CI qui déclenche le déploiement, une fois les images publiées.
   - N'utilise pas le mode **Raw** : Dokploy rejouerait alors le YAML collé dans son éditeur et ignorerait le dépôt.
4. **Environment** : colle `dashflow.env.example` rempli.
   - `POSTGRES_*` : à recopier depuis la fiche de `dashflow-db` (Internal Credentials).
   - `REDIS_URL` : un service **Database → Redis** dans le même projet, sans port externe ; l'URL interne se recopie de sa fiche (Internal Credentials). Attention à l'hôte : celui du **service**, pas celui de son volume (`…-data`).
   - `JWT_SECRET` et `TOTP_ENC_KEY` : à conserver hors du serveur (gestionnaire de mots de passe). Changer `TOTP_ENC_KEY` rend illisibles les secrets de double authentification ; changer `JWT_SECRET` déconnecte tout le monde.
   - `RESEND_API_KEY` et `MAIL_FROM` : le mail part par l'API de Resend, plus par SMTP. Le domaine de `MAIL_FROM` doit être vérifié chez Resend (Domains → Add Domain, puis les enregistrements SPF et DKIM à poser dans la zone Cloudflare). Crée une clé d'API avec le seul droit « Sending access », limitée à ce domaine.
   - `S3_*` : celles du bucket de documents.
5. **Domains** : sur le service `dashflow-web`, port `8080`, en HTTP (le TLS est assuré par Cloudflare), pour `dashflow.nedellec-julien.fr`. L'API n'a pas de domaine à elle.

   Le bouton _Preview Compose_ doit montrer les trois services, chacun sur `default` **et** sur `dokploy-network`.
6. **Premier déploiement** : à la main, avec le bouton Deploy. L'API applique les migrations qui manquent à la base, puis démarre.

   Vérification depuis le serveur :
   ```bash
   docker exec $(docker ps -qf name=dashflow-web) wget -qO- http://127.0.0.1:8080/api/health
   ```
   La réponse attendue est `{"ok":true}`. Une page HTML à la place signifie que le relais ne marche pas.
7. **Déclenchement par la CI** : ajoute ces secrets au dépôt.
   - `DOKPLOY_URL` : l'adresse du panneau, sans `/` final.
   - `DOKPLOY_API_KEY` : à créer dans Dokploy, Profil → API.
   - `DOKPLOY_COMPOSE_ID` : le dernier segment de l'URL du service.
   - `CF_ACCESS_CLIENT_ID` et `CF_ACCESS_CLIENT_SECRET` : nécessaires si le panneau est derrière Cloudflare Access. Crée un jeton de service (Zero Trust → Service Tokens), autorisé par une règle **Service Auth**.
   - Variable facultative `DEPLOY_HEALTH_URL` : `https://dashflow.nedellec-julien.fr/api/health`.

   Tant que les secrets Dokploy manquent, la CI publie les images sans déployer.

## Adresse du visiteur et limites de débit

Derrière le tunnel, Traefik puis le front ne voient que l'adresse du tunnel. L'API lit donc l'adresse du visiteur dans `CF-Connecting-IP` (`CLIENT_IP_HEADER`, posé par le compose), que le front relaie tel quel. Sans cela, tous les visiteurs partageraient les mêmes limites de débit.

Cet en-tête n'est digne de confiance que si **rien d'autre que le tunnel ne joint Traefik** : aucun port 80 ou 443 du serveur ne doit être ouvert sur Internet, redirection de la box comprise. Sinon, un client choisirait lui-même l'adresse comptée.

## Supervision

Deux sondes, à ne pas confondre :
- **`/api/health`** : sonde de **vie**, publique. Elle dit seulement que l'API tourne, sans toucher la base ni Redis. C'est celle du `HEALTHCHECK` Docker : une base en panne ne doit pas faire redémarrer l'API en boucle.
- **`/api/health/ready`** : sonde d'**état**, pour un monitoring externe. Elle vérifie la base **et Redis**, et répond 503 si l'un des deux est injoignable ou ne répond pas en 2 secondes. Elle n'existe (sinon 404) que si `HEALTH_TOKEN` est réglée et présentée dans l'en-tête `X-Health-Token`.

Mise en place :
1. Génère un jeton (`openssl rand -hex 24`) et ajoute `HEALTH_TOKEN=<jeton>` dans l'onglet Environment, puis redéploie.
2. Vérifie :
   ```bash
   curl -s -H "X-Health-Token: <jeton>" https://dashflow.nedellec-julien.fr/api/health/ready
   ```
   La réponse attendue est `{"ok":true,"db":true,"redis":true}`.
3. Dans ton outil de supervision (Uptime Kuma, Better Stack, UptimeRobot…), crée une sonde HTTP sur cette adresse, avec l'en-tête `X-Health-Token`, toutes les minutes, en alerte si le code n'est pas 200. Choisis un outil **hors du serveur** : s'il tombe avec lui, il ne peut pas te prévenir.

En cas d'alerte, les journaux de `dashflow-api` donnent la cause (`Sonde : Redis injoignable (…)`, ou une erreur de base).

## Vérifier après un déploiement

- `https://dashflow.nedellec-julien.fr/api/health` répond `{"ok":true}` ;
- les journaux de `dashflow-api` se terminent par `API Hono à l'écoute sur le port 3001`, sans ligne `Redis (throttling) : …` après ;
- en cas de doute sur le mail : « Mot de passe oublié » sur ton compte, le code doit arriver, envoyé par `MAIL_FROM` ;
- le lendemain, les journaux de `dashflow-backup` montrent `sauvegarde envoyée : dashflow-….dump.gpg`. Pour ne pas attendre : `/usr/local/bin/backup.sh once` dans le terminal de ce conteneur.

## Restaurer une sauvegarde

Dans une base **vide** (par exemple un nouveau service Postgres de Dokploy), `<objet>` étant le nom du fichier dans le bucket de sauvegarde :

```bash
docker run --rm --network dokploy-network -e PGHOST=<hôte> -e PGUSER=<compte> -e PGPASSWORD=<mot de passe> -e PGDATABASE=<base> -e BACKUP_S3_ENDPOINT=… -e BACKUP_S3_BUCKET=… -e BACKUP_S3_ACCESS_KEY=… -e BACKUP_S3_SECRET_KEY=… -e BACKUP_PASSPHRASE=… ghcr.io/j-ned/dashflow-backup:latest restore <objet>
```
