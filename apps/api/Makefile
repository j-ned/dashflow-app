COMPOSE = podman compose -f compose.dev.yaml

.PHONY: db-up db-down db-restore db-fresh db-pull

## Démarre la Postgres locale (1er boot = restauration auto)
db-up:
	$(COMPOSE) up -d

## Stoppe la Postgres locale (volume conservé)
db-down:
	$(COMPOSE) down

## Recrée la base à zéro (supprime le volume puis redémarre)
db-fresh:
	-$(COMPOSE) down --timeout 10
	$(COMPOSE) down -v
	$(COMPOSE) up -d

## Re-restaure le dump le plus récent dans la base en cours
db-restore:
	./scripts/db/restore.sh

## Récupère un dump frais de la prod (VPS)
db-pull:
	./scripts/db/pull.sh
