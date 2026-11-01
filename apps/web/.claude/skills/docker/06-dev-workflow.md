# Docker Workflow Dev — Reference

## Dev avec hot-reload (bind mounts)
```yaml
# compose.dev.yml
services:
  app:
    build:
      context: .
      target: development
    ports:
      - "3000:3000"
    volumes:
      - .:/app              # bind mount pour hot-reload
      - /app/node_modules   # exclure node_modules du bind
    environment:
      - NODE_ENV=development
    command: npm run start:dev
```

## Dev vs Prod avec override
```bash
# compose.yml (base) + compose.override.yml (dev, charge auto)
docker compose up -d

# Prod : specifier le fichier
docker compose -f compose.yml -f compose.prod.yml up -d
```

## Dockerfile multi-target
```dockerfile
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS development
COPY . .
CMD ["npm", "run", "start:dev"]

FROM base AS build
COPY . .
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
USER node
CMD ["node", "dist/main.js"]
```

## Stack complete dev (Angular + NestJS + PostgreSQL)
```yaml
services:
  frontend:
    build:
      context: ./frontend
      target: development
    ports:
      - "4200:4200"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npx ng serve --host 0.0.0.0

  backend:
    build:
      context: ./backend
      target: development
    ports:
      - "3000:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules
    environment:
      DATABASE_URL: postgres://user:password@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy
    command: npm run start:dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  db-data:
```

## Commandes utiles en dev
```bash
docker compose up -d --build     # rebuild + start
docker compose logs -f backend   # suivre les logs du backend
docker compose exec backend sh   # shell dans le backend
docker compose exec db psql -U user mydb  # client PostgreSQL
docker compose down -v           # tout nettoyer (volumes inclus)
docker compose restart backend   # redemarrer un service
```
