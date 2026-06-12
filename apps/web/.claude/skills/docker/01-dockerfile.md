# Dockerfile — Reference

## Structure de base
```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
USER node
CMD ["node", "src/index.js"]
```

## Instructions principales

### FROM — image de base
```dockerfile
FROM node:22-alpine AS build
FROM --platform=linux/amd64 ubuntu:22.04
FROM scratch  # image vide
```
- Doit etre la premiere instruction (sauf ARG)
- AS <name> pour nommer les stages (multi-stage)

### WORKDIR — repertoire de travail
```dockerfile
WORKDIR /app
# Cree le repertoire s'il n'existe pas
# Toujours utiliser des chemins absolus
```

### COPY — copier des fichiers
```dockerfile
COPY package*.json ./
COPY --from=build /app/dist ./dist
COPY --from=nginx:latest /etc/nginx/nginx.conf /nginx.conf
COPY --chmod=755 entrypoint.sh /app/
COPY --chown=node:node . .
COPY --exclude=*.md --exclude=*.test.ts . .
```

### ADD — copier + fonctionnalites avancees
```dockerfile
ADD https://example.com/file.tar.gz /app/  # telecharge + decompresse
ADD --checksum=sha256:abc123... https://example.com/binary /usr/bin/
```
- Preferer COPY pour les fichiers locaux simples
- ADD uniquement pour : URLs distantes, archives tar, checksums

### RUN — executer une commande (build-time)
```dockerfile
# Shell form
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Exec form
RUN ["sh", "-c", "echo $HOME"]

# Heredoc (plus lisible)
RUN <<EOF
apt-get update
apt-get install -y --no-install-recommends curl
rm -rf /var/lib/apt/lists/*
EOF

# Cache mount (deps)
RUN --mount=type=cache,target=/root/.npm npm ci

# Secret mount (credentials)
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci

# Bind mount (fichier temporaire)
RUN --mount=type=bind,source=requirements.txt,target=/tmp/requirements.txt \
    pip install -r /tmp/requirements.txt
```

### CMD — commande par defaut (runtime)
```dockerfile
CMD ["node", "src/index.js"]    # exec form (recommande)
CMD node src/index.js           # shell form
# Une seule CMD par Dockerfile — la derniere gagne
# Overridable par docker run
```

### ENTRYPOINT — executable principal
```dockerfile
ENTRYPOINT ["node"]
CMD ["src/index.js"]  # arguments par defaut
# docker run myapp src/other.js  → node src/other.js
```
- Exec form pour recevoir les signaux Unix (PID 1)
- Shell form : l'executable n'est PAS PID 1 → pas de SIGTERM

### ENV — variable d'environnement (persiste au runtime)
```dockerfile
ENV NODE_ENV=production
ENV PORT=3000
# Overridable : docker run -e PORT=8080
```

### ARG — variable de build (ne persiste pas)
```dockerfile
ARG NODE_VERSION=22
FROM node:${NODE_VERSION}-alpine
ARG BUILD_DATE
LABEL build-date=$BUILD_DATE
# docker build --build-arg BUILD_DATE=$(date -u +%Y%m%d) .
```

### EXPOSE — documenter les ports
```dockerfile
EXPOSE 3000/tcp
EXPOSE 5432
# Ne publie PAS le port — juste de la documentation
# Publier : docker run -p 3000:3000
```

### USER — utilisateur non-root
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
# Toujours executer en non-root en production
```

### VOLUME — point de montage
```dockerfile
VOLUME ["/data"]
```

### HEALTHCHECK
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
  CMD curl -f http://localhost:3000/health || exit 1
HEALTHCHECK NONE  # desactiver
```

### LABEL — metadata
```dockerfile
LABEL org.opencontainers.image.authors="julien@example.com"
LABEL version="1.0" description="My app"
```

### SHELL — changer le shell par defaut
```dockerfile
SHELL ["/bin/bash", "-c"]
```

## .dockerignore
```
node_modules
.git
.env
*.md
dist
coverage
.angular
```

## Variables d'environnement dans le Dockerfile
```dockerfile
ENV MY_VAR=hello
WORKDIR ${MY_VAR}           # /hello
COPY $MY_VAR /dest           # copie le fichier "hello"
# ${var:-default} — valeur par defaut
# ${var:+word} — mot si var est defini
```
