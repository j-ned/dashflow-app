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
# Commit déployé (passé par la CI) : relie chaque erreur Sentry à sa version et à ses source maps.
# Contrôlé avant usage : la valeur finit dans le code JavaScript de la build.
ARG SENTRY_RELEASE=""
RUN case "$SENTRY_RELEASE" in *[!0-9a-f]*) echo "SENTRY_RELEASE : SHA hexadécimal attendu" >&2; exit 1 ;; esac; \
    if [ -n "$SENTRY_RELEASE" ]; then \
      pnpm --filter @dashflow/web exec ng build --define "SENTRY_RELEASE='$SENTRY_RELEASE'"; \
    else \
      pnpm --filter @dashflow/web build; \
    fi
# Source maps : identifiants de débogage injectés dans les bundles (sentry-cli les associe grâce à la
# ligne sourceMappingURL), envoyées à Sentry quand la CI fournit le jeton (secret BuildKit, absent
# de l'image et des couches), puis retirées : ni servies ni référencées par les bundles publiés.
RUN --mount=type=secret,id=sentry_auth_token \
    set -eu; out=apps/web/dist/dash-flow/browser; \
    npx --yes @sentry/cli@3.8.2 sourcemaps inject "$out"; \
    if [ -s /run/secrets/sentry_auth_token ] && [ -n "$SENTRY_RELEASE" ]; then \
      SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token)" npx --yes @sentry/cli@3.8.2 sourcemaps upload \
        --org j-ned --project dashflow-app-angular --release "$SENTRY_RELEASE" "$out"; \
    fi; \
    find "$out" -name '*.map' -delete; \
    find "$out" -name '*.js' -exec sed -i '/^\/\/# sourceMappingURL=/d' {} +

# ── Stage 2: serve static SPA via nginx ──
# Statique Angular, et relais de /api/ vers l'API par le réseau interne de la pile
# (variable API_UPSTREAM, lue au démarrage par 40-dashflow-config.sh ; cf. deploy/compose.yaml).
# nginx sans root : écoute sur 8080 (à reporter dans le port interne du service Dokploy).
FROM nginxinc/nginx-unprivileged:alpine AS runtime
COPY --chmod=0555 apps/web/nginx/40-dashflow-config.sh /docker-entrypoint.d/40-dashflow-config.sh
COPY --from=build /repo/apps/web/dist/dash-flow/browser/ /usr/share/nginx/html/
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/index.html >/dev/null || exit 1
