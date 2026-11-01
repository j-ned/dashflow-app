# DashFlow

Monorepo pnpm : front Angular et API dans un seul dépôt (historiques de `ng-dashflow-app` et `nest-dashflow-app` conservés).

| Chemin     | Package          | Rôle                          |
| ---------- | ---------------- | ----------------------------- |
| `apps/web` | `@dashflow/web`  | Front Angular (SPA, nginx)    |
| `apps/api` | `@dashflow/api`  | API Hono + Drizzle/Postgres   |

## Commandes (depuis la racine)

```bash
pnpm install
pnpm dev:web            # ng serve
pnpm dev:api            # tsx watch (API sur :3001, servie au front sous /api)
pnpm lint
pnpm test
pnpm build
pnpm --filter @dashflow/api db:migrate
```

## Images Docker

Le contexte de build est la **racine** du dépôt (lockfile et `pnpm-workspace.yaml` y vivent) :

```bash
docker build -f apps/api/Dockerfile -t dashflow-api .
docker build -f apps/web/Dockerfile -t dashflow-web .
```

## Déploiement

Front et API partagent le domaine du front : Traefik route `/api` vers l'image de l'API (préfixe retiré).
Procédure de bascule et retour arrière : [docs/deploiement-meme-origine.md](docs/deploiement-meme-origine.md).
