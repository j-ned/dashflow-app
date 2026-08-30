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

| Variable | Rôle |
|---|---|
| `NODE_ENV` | Environnement d'exécution (`development`, `production`) |
| `PORT` | Port HTTP du serveur |
| `DATABASE_URL` | Chaîne de connexion PostgreSQL |
| `CORS_ORIGIN` | Origine(s) autorisée(s) pour le frontend, séparées par des virgules |
| `JWT_SECRET` | Secret de signature des tokens JWT (minimum 32 caractères) |
| `APP_URL` | URL publique de l'API, utilisée notamment dans les liens transmis par email |
| `MAILER` | Fournisseur d'envoi d'email (`console` ou `smtp`) |
| `DEMO_ENABLED` | Active le compte de démonstration en accès public |
| `S3_*` | Configuration du stockage de fichiers compatible S3 |
| `SMTP_*` | Configuration SMTP, utilisée quand `MAILER=smtp` |

La configuration est validée au démarrage (schéma Zod) : une variable manquante ou invalide empêche le serveur de démarrer.

## Scripts disponibles

| Commande | Description |
|---|---|
| `pnpm start:dev` | Démarrage en mode développement avec rechargement à chaud |
| `pnpm build` | Compilation du projet |
| `pnpm start:prod` | Démarrage depuis le build de production |
| `pnpm lint` | Lint avec correction automatique |
| `pnpm lint:check` | Lint sans correction, pour la CI |
| `pnpm format` | Formatage du code avec Prettier |
| `pnpm test` | Tests unitaires |
| `pnpm test:integration` | Tests d'intégration |
| `pnpm test:e2e` | Tests end-to-end |
| `pnpm test:cov` | Tests unitaires avec couverture |
| `pnpm db:generate` | Génération d'une migration Drizzle à partir du schéma |
| `pnpm db:migrate` | Application des migrations en attente |
| `pnpm db:check` | Vérification de cohérence du schéma Drizzle |
| `pnpm db:baseline` | Adoption d'une base existante sans rejouer l'historique des migrations |

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
  - Santé et famille : `patients`, `members`, `practitioners`, `appointments`, `medications`, `prescriptions`, `documents`, `reminders`, `shared-access`, `medical-calendar`
  - Administration : `admin`, `demo`, `consumables`

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

## Licence

Usage privé, non destiné à la redistribution.
