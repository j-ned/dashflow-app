# Contexte de build = racine du monorepo : docker build -f apps/api/Dockerfile .
# ── Stage 1: build (deps complètes + compilation TS) ──
FROM node:22-alpine AS build
# Version pnpm lue depuis "packageManager" (package.json racine) — source unique, pas de version en dur ici.
RUN corepack enable
# Toolchain pour les modules natifs (argon2)
RUN apk add --no-cache python3 make g++
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @dashflow/api
COPY apps/api/tsconfig.json apps/api/tsconfig.build.json apps/api/nest-cli.json apps/api/
COPY apps/api/src/ apps/api/src/
RUN pnpm --filter @dashflow/api build

# ── Stage 2: deps de prod uniquement (argon2 recompilé pour la cible) ──
FROM node:22-alpine AS prod-deps
RUN corepack enable
RUN apk add --no-cache python3 make g++
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --prod --frozen-lockfile --filter @dashflow/api

# ── Stage 3: runtime ──
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
# Même arborescence que le workspace : apps/api/node_modules contient des liens vers /app/node_modules/.pnpm.
WORKDIR /app/apps/api
# Runtime du binaire natif argon2
RUN apk add --no-cache libstdc++
COPY --from=prod-deps /repo/node_modules /app/node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./node_modules
COPY --from=build /repo/apps/api/dist ./dist
COPY apps/api/package.json ./
# Capacité de migration en étape séparée : scripts + fichiers de migration SQL.
COPY apps/api/scripts ./scripts
COPY apps/api/src/db/migrations ./src/db/migrations
USER node
EXPOSE 3001
# Swarm relance un conteneur mort, pas un process bloqué : la sonde HTTP fait la différence.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3001}/health" >/dev/null || exit 1
CMD ["sh", "-c", "node scripts/db/migrate.mjs && exec node dist/main"]
