# ── Stage 1: build (deps complètes + compilation TS) ──
FROM node:22-alpine AS build
# Version pnpm lue depuis "packageManager" (package.json) — source unique, pas de version en dur ici.
RUN corepack enable
# Toolchain pour les modules natifs (argon2)
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/
RUN pnpm build

# ── Stage 2: deps de prod uniquement (argon2 recompilé pour la cible) ──
FROM node:22-alpine AS prod-deps
RUN corepack enable
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ── Stage 3: runtime ──
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Runtime du binaire natif argon2
RUN apk add --no-cache libstdc++
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Capacité de migration en étape séparée : scripts + fichiers de migration SQL.
COPY scripts ./scripts
COPY src/db/migrations ./src/db/migrations
USER node
EXPOSE 3001
CMD ["sh", "-c", "node /app/scripts/db/migrate.mjs && exec node dist/main"]
