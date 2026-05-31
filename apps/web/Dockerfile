# ── Stage 1: build Angular ──
FROM node:22-alpine AS build
RUN corepack enable pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.app.json angular.json .postcssrc.json ./
COPY src/ src/
COPY public/ public/
RUN pnpm build

# ── Stage 2: serve static SPA via nginx ──
# NOTE: déploiement prod (proxy /api → backend NestJS, repo nest-dashflow-app) à finaliser
# dans une étape dédiée (Dokploy 2 services). Cette image ne sert que le statique Angular.
FROM nginx:alpine AS runtime
COPY --from=build /app/dist/dash-flow/browser/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
