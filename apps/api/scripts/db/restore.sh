#!/usr/bin/env bash
# Re-restaure le dump le plus récent de ~/backups/dashflow dans la DB locale.
# Idempotent grâce à --clean --if-exists. Le conteneur doit être démarré.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE="podman compose -f ${ROOT_DIR}/compose.dev.yaml"
BACKUP_DIR="${HOME}/backups/dashflow"

DUMP="$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -1 || true)"
if [ -z "${DUMP}" ]; then
  echo "Erreur : aucun dump dans ${BACKUP_DIR}. Lance d'abord 'make db-pull'." >&2
  exit 1
fi

echo "Restauration de ${DUMP}…"
${COMPOSE} exec -T db \
  pg_restore --clean --if-exists --no-owner --no-privileges \
  -U djoudj -d dashflow_db < "${DUMP}"

COUNT="$(${COMPOSE} exec -T db psql -U djoudj -d dashflow_db -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';")"
echo "Restauration terminée. Tables publiques : ${COUNT// /}"
