# Multi-Stage Builds Docker — Reference

## Concept
Separer la construction (build) de l'execution (runtime) pour des images minimales.

## Pattern Node.js / Angular
```dockerfile
# syntax=docker/dockerfile:1

# Stage 1 — Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — Production
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Pattern Angular (servir avec nginx)
```dockerfile
# Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

# Serve
FROM nginx:alpine AS production
COPY --from=build /app/dist/my-app/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## Pattern NestJS
```dockerfile
# Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production (deps only)
FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Nommer les stages
```dockerfile
FROM golang:1.25 AS build
# ...
FROM scratch
COPY --from=build /bin/hello /bin/hello
```

## Copier depuis une image externe
```dockerfile
COPY --from=nginx:latest /etc/nginx/nginx.conf /nginx.conf
```

## Cibler un stage specifique
```bash
docker build --target build -t myapp:build .
# Utile pour : debug, tests, dev vs prod
```

## Etendre un stage precedent
```dockerfile
FROM node:22-alpine AS base
RUN npm i -g pnpm

FROM base AS development
# ...

FROM base AS production
# ...
```

## BuildKit
- Build uniquement les stages necessaires (pas les stages non utilises)
- Parallelise les stages independants
- Activer : DOCKER_BUILDKIT=1 (defaut depuis Docker 23+)
