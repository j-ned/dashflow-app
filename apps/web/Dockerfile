# ── Stage 1: Build Angular frontend ──
FROM node:22-alpine AS frontend-build

RUN corepack enable pnpm

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json tsconfig.app.json angular.json .postcssrc.json ./
COPY scripts/ scripts/
COPY src/ src/
COPY public/ public/
RUN pnpm build


# ── Stage 2: Build Hono backend ──
FROM node:22-alpine AS backend-build

RUN corepack enable pnpm

WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY backend/tsconfig.json ./
COPY backend/src/ src/
RUN pnpm build


# ── Stage 3: Production runtime ──
FROM node:22-alpine AS runtime

RUN apk add --no-cache dumb-init \
 && addgroup -S app && adduser -S app -G app

WORKDIR /app

# Backend deps (production only — includes drizzle-kit for db:push)
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod

# Backend build output
COPY --from=backend-build /app/backend/dist/ dist/

# Drizzle config + schema (needed for db:push at startup)
COPY backend/drizzle.config.ts ./
COPY backend/src/db/ src/db/

# Frontend build output
COPY --from=frontend-build /app/dist/dash-flow/browser/ static/

# Entrypoint script (db:push + start)
COPY entrypoint.sh ./

# Non-root user
USER app

ENV NODE_ENV=production
ENV STATIC_ROOT=static
ENV PORT=3000
ENV DOTENV_PATH=.env

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["sh", "entrypoint.sh"]
