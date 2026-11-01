# Contexte de build = racine du monorepo : docker build -f apps/web/Dockerfile .
# ── Stage 1: build Angular ──
FROM node:22-alpine AS build
# Version pnpm lue depuis "packageManager" (package.json racine).
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @dashflow/web
COPY apps/web/tsconfig.json apps/web/tsconfig.app.json apps/web/angular.json apps/web/.postcssrc.json apps/web/
COPY apps/web/src/ apps/web/src/
COPY apps/web/public/ apps/web/public/
RUN pnpm --filter @dashflow/web build

# ── Stage 2: serve static SPA via nginx ──
# Cette image ne sert que le statique Angular ; /api est routé par Traefik vers l'image de l'API
# (même domaine, cf. docs/deploiement-meme-origine.md à la racine du dépôt).
# nginx sans root : écoute sur 8080 (à reporter dans le port interne du service Dokploy).
FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY --from=build /repo/apps/web/dist/dash-flow/browser/ /usr/share/nginx/html/
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/index.html >/dev/null || exit 1
