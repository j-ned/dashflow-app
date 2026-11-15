#!/usr/bin/env bash
# Valide `compose.yaml` avant qu'il parte en production : Dokploy lit ce fichier dans le dépôt à
# chaque déploiement, donc un fichier invalide fusionné serait déployé tel quel. Les variables
# viennent du modèle `dashflow.env.example`, les vides remplies d'une valeur factice.
#   .github/scripts/compose.check.sh
set -euo pipefail

DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../deploy" && pwd)"
ENV_FILE="$(mktemp)"
trap 'rm -f "$ENV_FILE"' EXIT

sed -E 's/^([A-Z0-9_]+)=$/\1=valeur/' "$DEPLOY/dashflow.env.example" > "$ENV_FILE"

services="$(docker compose --env-file "$ENV_FILE" -f "$DEPLOY/compose.yaml" config --services | sort | paste -sd' ')"
echo "compose.yaml valide, services : $services"
