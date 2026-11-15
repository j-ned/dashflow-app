# Déploiement sur le serveur (Dokploy) et bascule depuis Vercel + Neon

La pile de production est `compose.yaml` :
- **`dashflow-web`** : nginx sert le front et relaie `/api/` vers l'API.
- **`dashflow-api`** : l'API Node. Elle applique ses migrations au démarrage et fait tourner ses tâches planifiées.
- **`dashflow-redis`** : les compteurs de limitation (connexions, envois de code), partagés par toutes les instances de l'API. Sans persistance : un redémarrage remet les compteurs à zéro, ce qui est sans conséquence.
- **`dashflow-backup`** : sauvegarde quotidienne chiffrée de la base.

La base Postgres 18 est **hors de la pile** : c'est le service de base de données `dashflow-db` de Dokploy, que l'API et la sauvegarde joignent par `dokploy-network`. Dokploy ne construit rien : il tire les images publiées sur GHCR par la CI (`dashflow-web`, `dashflow-api`, `dashflow-backup`). Le trafic arrive par le tunnel Cloudflare, puis passe par le Traefik de Dokploy.

Tant que l'étape « Bascule » n'est pas faite, Vercel et Neon restent la production : tout ce qui précède est sans impact.

## Mise en place (une fois)

1. **Paquets GHCR** : ils sont créés à la première publication depuis `master`. S'ils sont publics, rien à faire. S'ils sont privés, déclare `ghcr.io` dans les registres de Dokploy avec un jeton `read:packages`.
2. **Buckets** : il en faut deux, privés, chacun avec un jeton d'API limité à son bucket.
   - **Documents** : un bucket **distinct** de celui que Vercel utilise. Sinon, une suppression faite sur le serveur effacerait le fichier de l'ancienne production. Les fichiers y sont copiés (voir « Copie des documents »).
   - **Sauvegardes** : par exemple `dashflow-backups`, avec une règle de cycle de vie qui supprime les objets après la durée voulue (30 jours, par exemple).
3. **Dokploy** : dans le projet où se trouve `dashflow-db`, crée un service de type **Compose** dont la source est le dépôt.
   - Fournisseur **Git**, URL `https://github.com/j-ned/dashflow-app.git`, branche `master`.
   - Compose Path : `./deploy/compose.yaml`. La valeur par défaut, `./docker-compose.yml`, échoue avec « Compose file not found ».
   - **Auto Deploy désactivé** : c'est la CI qui déclenche le déploiement, une fois les images publiées.
   - N'utilise pas le mode **Raw** : Dokploy rejouerait alors le YAML collé dans son éditeur et ignorerait le dépôt.
4. **Environment** : colle `dashflow.env.example` rempli.
   - `POSTGRES_*` : à recopier depuis la fiche de `dashflow-db` (Internal Credentials).
   - `JWT_SECRET` et `TOTP_ENC_KEY` : à reprendre **à l'identique** du projet Vercel.
   - `RESEND_API_KEY` et `MAIL_FROM` : le mail part par l'API de Resend, plus par SMTP. Le domaine de `MAIL_FROM` doit être vérifié chez Resend (Domains → Add Domain, puis les enregistrements SPF et DKIM à poser dans la zone Cloudflare). Crée une clé d'API avec le seul droit « Sending access », limitée à ce domaine.
   - `S3_*` : celles du **nouveau** bucket de documents.
5. **Domains** : sur le service `dashflow-web`, port `8080`, en HTTP (le TLS est assuré par Cloudflare), pour `dashflow.nedellec-julien.fr`. L'API n'a pas de domaine à elle.

   Le bouton _Preview Compose_ doit montrer `dashflow-web`, `dashflow-api` et `dashflow-backup` sur `default` **et** `dokploy-network`, et `dashflow-redis` sur `default` seulement.
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

## Import des données depuis Neon

Pour le dump, utilise un client de la même version que la base d'origine (18) et l'URL Neon **directe**, sans `-pooler` :

```bash
read -rs NEON_URL
```

```bash
(umask 077; docker run --rm -e NEON_URL="$NEON_URL" postgres:18-alpine sh -c 'pg_dump "$NEON_URL" -Fc --no-owner --no-acl' > ~/dashflow-neon.dump; echo "code=$?")
```

La restauration se fait dans une seule transaction : en cas d'erreur, rien n'est modifié. `--clean` remplace ce que la base contient déjà, y compris une copie précédente. Avant de lancer la commande, vérifie avec `docker ps` que `<db>` est bien le conteneur de `dashflow-db` :

```bash
docker exec -i <db> sh -c 'pg_restore --clean --if-exists --single-transaction --no-owner --no-acl --exit-on-error -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < ~/dashflow-neon.dump; echo "code=$?"
```

```bash
docker restart $(docker ps -qf name=dashflow-api)
```

Le redémarrage rejoue les migrations que Neon n'avait pas. Compare ensuite le nombre de lignes des deux côtés, puis efface le fichier, qui contient les données :

```bash
shred -u ~/dashflow-neon.dump; unset NEON_URL
```

## Copie des documents

Copie du bucket de Vercel vers le nouveau, sans rien modifier à la source. Il faut **deux** remotes rclone :
- `src` : avec un jeton en **lecture seule** sur l'ancien bucket.
- `dst` : avec le jeton du nouveau bucket.

```bash
docker run --rm -it -v ~/.config/rclone:/config/rclone rclone/rclone:1.71 copy src:<ancien-bucket> dst:<nouveau-bucket> --checksum --progress
```

`copy`, et non `sync`, ne supprime jamais rien à la destination. À relancer au moment de la bascule pour reprendre les fichiers ajoutés entre-temps.

## Bascule (coupure de quelques minutes)

1. **Geler les écritures** : dans Vercel, projet `dashflow-app` → _Settings_ → _Domains_, retire `dashflow.nedellec-julien.fr`. Plus rien n'écrit dans Neon.
2. Refais l'import des données et la copie des documents (ci-dessus).
3. Dans Cloudflare → Zero Trust → tunnel du serveur → _Public Hostnames_, ajoute `dashflow.nedellec-julien.fr` vers le même service que les autres sites du serveur (le Traefik de Dokploy). Si Cloudflare refuse parce que le CNAME vers Vercel existe, supprime-le d'abord dans la zone DNS.
4. Vérifie :
   - `https://dashflow.nedellec-julien.fr/api/health` ;
   - la connexion par mot de passe et par Google, puis la 2FA ;
   - un mail réel : « Mot de passe oublié » sur ton compte, le code doit arriver (et l'expéditeur être `MAIL_FROM`) ;
   - une page budget, une page médicale, l'ouverture et l'envoi d'un document ;
   - la console du navigateur, qui ne doit montrer aucune erreur CSP ;
   - le lendemain, les journaux de `dashflow-backup`.

## Retour arrière

Retire le _Public Hostname_ du tunnel, recrée le CNAME vers Vercel et rattache le domaine au projet Vercel.

**Les écritures faites sur le serveur depuis la bascule ne sont pas dans Neon.** Si besoin, fais un `pg_dump` de `dashflow-db` puis un `pg_restore` vers Neon, et copie les documents dans l'autre sens.

## Restaurer une sauvegarde

Dans une base **vide** (par exemple un nouveau service Postgres de Dokploy), `<objet>` étant le nom du fichier dans le bucket de sauvegarde :

```bash
docker run --rm --network dokploy-network -e PGHOST=<hôte> -e PGUSER=<compte> -e PGPASSWORD=<mot de passe> -e PGDATABASE=<base> -e BACKUP_S3_ENDPOINT=… -e BACKUP_S3_BUCKET=… -e BACKUP_S3_ACCESS_KEY=… -e BACKUP_S3_SECRET_KEY=… -e BACKUP_PASSPHRASE=… ghcr.io/j-ned/dashflow-backup:latest restore <objet>
```
