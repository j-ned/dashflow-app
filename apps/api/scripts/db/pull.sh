#!/usr/bin/env bash
# Récupère un dump frais de la prod (VPS) vers ~/backups/dashflow.
# Le mot de passe est lu depuis l'env du conteneur distant — rien n'est codé en dur.
set -euo pipefail

BACKUP_DIR="${HOME}/backups/dashflow"
mkdir -p "${BACKUP_DIR}"
TS="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/dashflow_db_${TS}.dump"

echo "Dump de la prod via ssh vps…"
ssh vps 'CID=$(sudo docker ps -qf name=dashflow-app-database); \
  PW=$(sudo docker exec "$CID" printenv POSTGRES_PASSWORD); \
  sudo docker exec -e PGPASSWORD="$PW" "$CID" pg_dump -U djoudj -d dashflow_db -Fc' \
  > "${OUT}"

if [ ! -s "${OUT}" ]; then
  echo "Erreur : dump vide, échec." >&2
  rm -f "${OUT}"
  exit 1
fi
echo "Dump écrit : ${OUT} ($(du -h "${OUT}" | cut -f1))"
