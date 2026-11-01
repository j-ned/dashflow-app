# Bonnes Pratiques Docker — Reference

## Images de base
- Utiliser des images officielles (Docker Official Images)
- Preferer Alpine pour la taille (<6 Mo) et la securite
- Epingler les versions : node:22-alpine (pas node:latest)
- Pour la reproductibilite : epingler par digest
  FROM node:22-alpine@sha256:abc123...

## Optimisation des layers

### Ordre des instructions (cache)
Les instructions changent rarement → en premier. Les instructions changent souvent → en dernier.
```dockerfile
# BON — deps en premier, code en dernier
COPY package*.json ./
RUN npm ci
COPY . .

# MAUVAIS — tout invalide le cache a chaque changement de code
COPY . .
RUN npm ci
```

### Combiner les commandes RUN
```dockerfile
# BON
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# MAUVAIS — 3 layers, cache apt non nettoye
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y git
```

### .dockerignore
```
node_modules
.git
.env
*.md
dist
coverage
.angular
__pycache__
.pytest_cache
```

## Securite

### Non-root user (obligatoire en prod)
```dockerfile
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
```

### Pas de secrets dans l'image
```dockerfile
# BON — mount secret temporaire
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci

# MAUVAIS — secret persiste dans le layer
COPY .npmrc /root/.npmrc
RUN npm ci
RUN rm /root/.npmrc  # TROP TARD — le layer precedent contient le fichier
```

### Scan de vulnerabilites
```bash
docker scout quickview myimage
docker scout cves myimage
```

## Multi-stage (toujours)
- Stage build : toutes les deps de build
- Stage production : uniquement le runtime + artefacts
- Resultat : images 10-100x plus petites

## CMD vs ENTRYPOINT
- CMD : commande par defaut, overridable
- ENTRYPOINT : executable fixe, CMD fournit les arguments par defaut
- Toujours utiliser l'exec form ["..."] pour recevoir les signaux Unix

## Healthcheck
Toujours ajouter un healthcheck en production :
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

## Taille des images
```bash
docker images                    # voir les tailles
docker history myimage           # voir les layers
docker system df                 # espace disque utilise
docker system prune -a           # nettoyer tout (attention)
```

## Principes de conception
- Un container = un processus
- Containers ephemeres : peuvent etre arretes/detruits/recrees sans perte
- Decouplage : app, db, cache dans des containers separes
- Communication via Docker networks (pas de liens directs)
