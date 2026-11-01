# DashFlow

Monorepo pnpm : front Angular et API dans un seul dépôt (historiques de `ng-dashflow-app` et `nest-dashflow-app` conservés).

| Chemin     | Package          | Rôle                          |
| ---------- | ---------------- | ----------------------------- |
| `apps/web` | `@dashflow/web`  | Front Angular (SPA, nginx)    |
| `apps/api` | `@dashflow/api`  | API NestJS + Drizzle/Postgres |

## Commandes (depuis la racine)

```bash
pnpm install
pnpm dev:web            # ng serve
pnpm dev:api            # nest start --watch
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
