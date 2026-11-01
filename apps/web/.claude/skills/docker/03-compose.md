# Docker Compose — Reference

## Structure compose.yml
```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./src:/app/src
    networks:
      - app-network
    restart: unless-stopped

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
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

networks:
  app-network:
    driver: bridge

volumes:
  db-data:
```

## Commandes essentielles
```bash
docker compose up -d              # demarrer en arriere-plan
docker compose up -d --build      # rebuilder et demarrer
docker compose down               # arreter et supprimer
docker compose down -v            # + supprimer les volumes
docker compose logs -f app        # suivre les logs
docker compose exec app sh        # shell dans un container
docker compose ps                 # lister les containers
docker compose pull               # telecharger les images
docker compose restart app        # redemarrer un service
```

## Services

### build
```yaml
# Simple
build: .

# Avec options
build:
  context: .
  dockerfile: Dockerfile.prod
  target: production
  args:
    NODE_VERSION: 22
```

### ports
```yaml
ports:
  - "3000:3000"           # host:container
  - "127.0.0.1:8080:80"   # bind sur localhost uniquement
  - "6060:6060/udp"        # protocole UDP
  - target: 80
    published: "8080"
    protocol: tcp
    host_ip: 127.0.0.1
```

### volumes
```yaml
volumes:
  - ./src:/app/src          # bind mount (dev)
  - db-data:/var/lib/postgresql/data  # named volume (persist)
  - /app/node_modules       # volume anonyme (exclure)
  - type: bind
    source: ./config
    target: /app/config
    read_only: true
```

### environment et env_file
```yaml
# Inline
environment:
  NODE_ENV: production
  DATABASE_URL: postgres://user:pass@db:5432/mydb

# Fichier externe
env_file:
  - path: ./.env
    required: true
  - path: ./.env.local
    required: false
```

### depends_on
```yaml
depends_on:
  db:
    condition: service_healthy    # attendre le healthcheck
  redis:
    condition: service_started    # attendre le demarrage
  migration:
    condition: service_completed_successfully  # attendre la fin
```

### healthcheck
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### restart
```yaml
restart: "no"            # jamais (defaut)
restart: always          # toujours
restart: on-failure:3    # sur erreur, max 3 fois
restart: unless-stopped  # sauf arret explicite
```

### command et entrypoint
```yaml
command: ["node", "dist/main.js"]
entrypoint: ["/app/entrypoint.sh"]
```

### profiles (demarrage conditionnel)
```yaml
services:
  app:
    # pas de profile = toujours demarre

  debug:
    profiles: ["debug"]
    # docker compose --profile debug up
```

## Networking

### Communication inter-services
- Les services se resolvent par nom : http://db:5432
- Utiliser CONTAINER_PORT pour la communication interne (pas HOST_PORT)
- Toujours referencer par nom, jamais par IP

### Reseaux custom
```yaml
services:
  proxy:
    networks: [frontend]
  app:
    networks: [frontend, backend]
  db:
    networks: [backend]

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
```
- Les services ne communiquent que s'ils partagent un reseau
- proxy et db sont isoles : seul app voit les deux

### Reseau externe
```yaml
networks:
  existing:
    name: my-pre-existing-network
    external: true
```

## Secrets
```yaml
services:
  app:
    secrets:
      - db_password
secrets:
  db_password:
    file: ./secrets/db_password.txt
# Monte dans /run/secrets/db_password
```

## Configs
```yaml
services:
  app:
    configs:
      - source: nginx_config
        target: /etc/nginx/conf.d/default.conf
configs:
  nginx_config:
    file: ./nginx.conf
```
