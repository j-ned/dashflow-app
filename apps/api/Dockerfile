# ── Stage 1: build (deps complètes + compilation TS) ──
FROM node:22-alpine AS build
# pnpm pinné sur la version locale (honore onlyBuiltDependencies → argon2 compilé)
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
# Toolchain pour les modules natifs (argon2)
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src/ src/
RUN pnpm build

# ── Stage 2: deps de prod uniquement (argon2 recompilé pour la cible) ──
FROM node:22-alpine AS prod-deps
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# ── Stage 3: runtime ──
# Le boot ne migre JAMAIS (CMD = node dist/main). Mais l'image EST capable de migrer
# via une étape séparée : `node scripts/db/migrate.mjs` (et baseline.mjs) utilisent le
# migrateur programmatique de drizzle-orm (déjà dans node_modules de prod) + les SQL
# embarqués ci-dessous. Pas de drizzle-kit dans l'image (devDep, exclu).
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
CMD ["node", "dist/main"]
