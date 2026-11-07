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

Production sur **Vercel** : un projet, deux services (`vercel.json`). Le front est servi à la racine et l'API sous `/api`, sur le même domaine.
Procédure complète (Neon, Upstash, variables, copie des données, domaine, retour arrière) : [docs/deploiement-vercel.md](docs/deploiement-vercel.md).

Previews isolées de la production (base Neon `preview`, aucun email, variables Preview) : [docs/preview-env.md](docs/preview-env.md).

Auto-hébergement Docker (Dokploy/Traefik, images `apps/*/Dockerfile`) : [docs/deploiement-meme-origine.md](docs/deploiement-meme-origine.md).
