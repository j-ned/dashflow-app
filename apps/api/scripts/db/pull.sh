#!/usr/bin/env bash
# Récupère un dump frais de la prod (VPS) vers ~/backups/dashflow.
# Identifiants lus dans l'env du conteneur distant — rien n'est codé en dur, rien ne transite ici.
set -euo pipefail

BACKUP_DIR="${HOME}/backups/dashflow"
mkdir -p "${BACKUP_DIR}"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/dashflow_db_${TS}.dump"

# Hôte SSH du Dokploy (groupe docker, pas de sudo) ; conteneur repéré par son préfixe de nom.
SSH_HOST="${DASHFLOW_SSH_HOST:-homeserver}"

echo "Dump de la prod via ssh ${SSH_HOST}…"
ssh "${SSH_HOST}" 'CID=$(docker ps -qf name=dashflow-database); \
  test -n "$CID" || { echo "Conteneur dashflow-database introuvable" >&2; exit 1; }; \
  docker exec "$CID" sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc"' \
  > "${OUT}"

if [ ! -s "${OUT}" ]; then
  echo "Erreur : dump vide, échec." >&2
  rm -f "${OUT}"
  exit 1
fi
echo "Dump écrit : ${OUT} ($(du -h "${OUT}" | cut -f1))"
