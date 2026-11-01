# DashFlow API

API backend de l'application DashFlow, construite avec NestJS, Drizzle ORM et PostgreSQL. Elle expose la gestion budgétaire (comptes, enveloppes, transactions, prêts, virements récurrents) et la gestion santé/famille (patients, praticiens, rendez-vous, traitements, ordonnances, documents).

## Stack technique

- Runtime : Node.js, TypeScript (mode strict)
- Framework : NestJS 11
- Base de données : PostgreSQL, accès via Drizzle ORM
- Validation : Zod (pipes de validation Nest)
- Authentification : JWT (access token court + refresh token), 2FA TOTP, guard global via Throttler
- Stockage fichiers : S3 compatible (Cloudflare R2)
- Observabilité : Sentry
- Tests : Vitest (unitaires, intégration, end-to-end)
- Gestionnaire de paquets : pnpm

## Prérequis

- Node.js 22 ou supérieur
- pnpm
- PostgreSQL 18 (ou Docker/Podman pour l'environnement de développement fourni)

## Installation

```bash
pnpm install
cp .env.example .env
```

Renseigner les variables d'environnement dans `.env` (voir la section Configuration ci-dessous).

## Base de données locale

Un environnement PostgreSQL de développement est fourni via Compose :

```bash
docker compose -f compose.dev.yaml up -d
```

Appliquer ensuite les migrations :

```bash
pnpm db:migrate
```

## Démarrage

```bash
# développement, avec rechargement à chaud
pnpm start:dev

# développement, sans rechargement
pnpm start

# débogage
pnpm start:debug

# production (nécessite un build préalable)
pnpm build
pnpm start:prod
```

Le serveur écoute par défaut sur le port défini par `PORT` (3001 en développement).

## Configuration

Variables d'environnement principales (voir `.env.example` pour la liste complète) :

| Variable       | Rôle                                                                         |
| -------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`     | Environnement d'exécution (`development`, `production`)                      |
| `PORT`         | Port HTTP du serveur                                                         |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL                                               |
| `CORS_ORIGIN`  | Origine(s) autorisée(s) pour le frontend, séparées par des virgules          |
| `JWT_SECRET`   | Secret de signature des tokens JWT (minimum 32 caractères)                   |
| `APP_URL`      | URL publique de l'API, utilisée notamment dans les liens transmis par email  |
| `MAILER`       | Fournisseur d'envoi d'email (`console` ou `smtp`)                            |
| `DEMO_ENABLED` | Active le compte de démonstration en accès public                            |
| `HEALTH_TOKEN` | Jeton de `GET /health/ready` (état de la base) ; absent, la route répond 404 |
| `S3_*`         | Configuration du stockage de fichiers compatible S3                          |
| `SMTP_*`       | Configuration SMTP, utilisée quand `MAILER=smtp`                             |

La configuration est validée au démarrage (schéma Zod) : une variable manquante ou invalide empêche le serveur de démarrer.

## Scripts disponibles

| Commande                | Description                                                            |
| ----------------------- | ---------------------------------------------------------------------- |
| `pnpm start:dev`        | Démarrage en mode développement avec rechargement à chaud              |
| `pnpm build`            | Compilation du projet                                                  |
| `pnpm start:prod`       | Démarrage depuis le build de production                                |
| `pnpm lint`             | Lint avec correction automatique                                       |
| `pnpm lint:check`       | Lint sans correction, pour la CI                                       |
| `pnpm format`           | Formatage du code avec Prettier                                        |
| `pnpm test`             | Tests unitaires                                                        |
| `pnpm test:integration` | Tests d'intégration                                                    |
| `pnpm test:e2e`         | Tests end-to-end                                                       |
| `pnpm test:cov`         | Tests unitaires avec couverture                                        |
| `pnpm db:generate`      | Génération d'une migration Drizzle à partir du schéma                  |
| `pnpm db:migrate`       | Application des migrations en attente                                  |
| `pnpm db:check`         | Vérification de cohérence du schéma Drizzle                            |
| `pnpm db:baseline`      | Adoption d'une base existante sans rejouer l'historique des migrations |

## Architecture

Le code applicatif est organisé par domaine sous `src/` :

- `auth/` : authentification, JWT, 2FA, gestion de session
- `db/` : configuration Drizzle, schéma, migrations
- `config/` : chargement et validation de la configuration
- `common/` : guards, pipes, filtres et éléments transverses
- `mail/` : envoi d'email
- `storage/` : stockage de fichiers (S3)
- `health/` : endpoint de supervision
- `modules/` : modules métier, un dossier par domaine fonctionnel :
  - Budget : `bank-accounts`, `envelopes`, `account-transactions`, `loans`, `recurring-entries`, `salary-archives`
  - Santé et famille : `patients`, `members`, `practitioners`, `appointments`, `medications`, `prescriptions`, `documents`, `reminders`
  - Administration : `admin`, `demo`

Chaque module suit la structure standard NestJS : contrôleur, service, DTO/schéma de validation, tests colocalisés (`*.spec.ts`).

## Tests

```bash
pnpm test              # unitaires
pnpm test:integration  # intégration (nécessite une base de données)
pnpm test:e2e          # end-to-end
```

Les tests sont écrits avec Vitest et colocalisés avec le code qu'ils couvrent.

## Sécurité

- En-têtes de sécurité via Helmet
- Limitation de débit globale via `ThrottlerGuard`
- Mots de passe hachés avec Argon2
- Tokens JWT à durée de vie courte, avec rotation du refresh token
- Application derrière un reverse proxy : `trust proxy` est activé pour que la limitation de débit s'applique par IP réelle, pas par IP du proxy

Toute variable sensible (secrets, identifiants) doit être fournie via variables d'environnement, jamais commitée dans le dépôt.

### Chiffrement de bout en bout : ce qu'une copie de la base révèle

Pour un compte chiffré (tous les comptes hors démo), le contenu métier est chiffré dans le navigateur (AES-GCM, clé maîtresse jamais envoyée au serveur) et stocké dans la colonne `encrypted_data` de chaque ligne ; les colonnes métier correspondantes restent vides ou à leur valeur par défaut. Le serveur, un administrateur ou une sauvegarde volée ne peuvent donc pas lire les montants, les libellés, les noms des patients et praticiens, les motifs et comptes rendus, les posologies ni le contenu des fichiers.

Le chiffrement ne couvre pas tout. Voici ce qui reste lisible dans un dump, pour ne rien promettre de plus que ce qui est fait :

| Donnée en clair                                                                                                                                                                                                  | Où                                                                   | Ce que ça révèle                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E-mail, nom affiché, rôle, date de création, 2FA active ou non                                                                                                                                                   | `users`                                                              | L'identité du titulaire du compte                                                                                                                                                        |
| Identifiants et liens entre lignes (`user_id`, `member_id`, `patient_id`, `practitioner_id`, `appointment_id`, `prescription_id`, `account_id`, `to_account_id`, `envelope_id`, `loan_id`, `recurring_entry_id`) | toutes les tables métier                                             | La **forme** des données : combien de patients, de rendez-vous par patient, d'ordonnances par praticien, de mouvements par compte — sans les noms ni les montants                        |
| `created_at`                                                                                                                                                                                                     | toutes les tables métier                                             | Le rythme de saisie (quand une ligne a été créée, pas la date du rendez-vous ou de l'opération)                                                                                          |
| `direction`                                                                                                                                                                                                      | `loans`, `account_transactions`                                      | Le sens d'un prêt ou d'un mouvement (prêté/emprunté, dépense/revenu/virement), pas son montant                                                                                           |
| Clé de l'objet stocké (`file_url`, `document_url`, `payslip_key`)                                                                                                                                                | `documents`, `prescriptions`, `salary_archives`, `recurring_entries` | Qu'un fichier existe et à quelle ligne il est rattaché ; le fichier lui-même est chiffré côté client avant l'envoi                                                                       |
| Cible et état des rappels                                                                                                                                                                                        | `reminders`                                                          | Le rendez-vous ou le médicament visé (par identifiant) et actif/inactif. Aucune donnée personnelle : un rappel est un export calendrier fabriqué dans le navigateur, l'API n'envoie rien |
| Type d'événement, adresse IP, user-agent, date                                                                                                                                                                   | `security_events`                                                    | Le journal de connexion des 180 derniers jours                                                                                                                                           |
| Sel, clé maîtresse emballée, clé de récupération emballée                                                                                                                                                        | `users`                                                              | Rien d'exploitable sans le mot de passe ou la clé de récupération, mais ils permettent une attaque hors ligne sur un mot de passe faible (PBKDF2, 600 000 itérations)                    |

Les blobs sont liés à leur ligne : depuis le format `v2.`, l'identifiant de la ligne est authentifié avec le chiffré (AAD `dashflow:row:<id>`), un blob ne peut pas être recopié d'une ligne à une autre. Les clés étrangères le sont aussi : le client les recopie dans le blob (`__refs`) et refuse à la lecture une ligne qui pointe ailleurs que ce qui a été scellé. Quelqu'un qui écrit dans la base ne peut donc plus rattacher un rendez-vous à un autre patient du même compte ; il peut seulement détacher une ligne (référence mise à `null`, ce que fait aussi le serveur quand la cible est supprimée). Les blobs écrits avant cette protection sont scellés à leur prochaine écriture.

Le compte de démonstration n'est pas chiffré : ses données sont fictives, réinitialisées toutes les 6 heures et recalées sur la date du jour.

### Sondes de santé

- `GET /health` : sonde de vie publique (`{ "ok": true }`), utilisée par le `HEALTHCHECK` Docker. Elle ne touche pas la base : une base en panne ne doit pas faire redémarrer l'API en boucle.
- `GET /health/ready` : état de la base (200, ou 503 si elle est injoignable), réservé à qui présente l'en-tête `x-health-token: $HEALTH_TOKEN`. Sans jeton configuré ou avec un mauvais jeton, la route répond 404.

L'API s'arrête proprement sur `SIGTERM` / `SIGINT` (requêtes en cours terminées, connexions Postgres rendues, code de sortie 0).

### Règles métier assumées

Décidées avec le propriétaire du produit le 20 septembre 2026 ; ce ne sont pas des oublis.

- **Se déconnecter ferme la session sur tous les appareils.** Les jetons durent 7 jours : c'est le seul moyen de rendre inutilisable un cookie volé.
- **Un remboursement supérieur au restant dû est refusé** (400) : c'est presque toujours une faute de frappe, et l'opération enregistrée doit correspondre à ce qui a été saisi.
- **La double authentification ne se reconfigure pas tant qu'elle est active** (409) : pour changer d'appareil on la désactive (mot de passe exigé) puis on la réactive. Une session ouverte ne suffit donc pas à remplacer le secret.
- **Pas d'unicité serveur sur le mois d'une archive de paie.** Pour un compte chiffré le mois est dans le blob : une contrainte ne protégerait que les comptes en clair. Le client met à jour l'archive du mois au lieu d'en créer une seconde.

## Licence

Usage privé, non destiné à la redistribution.
