#!/usr/bin/env bash
# Restauration automatique au premier boot (volume vide).
# Le dossier ~/backups/dashflow de l'hôte est monté en lecture seule sur /dumps.
set -euo pipefail

DUMP="$(ls -1t /dumps/*.dump 2>/dev/null | head -1 || true)"

if [ -z "${DUMP}" ]; then
  echo "[initdb] Aucun dump trouvé dans /dumps — base laissée vide."
  exit 0
fi

echo "[initdb] Restauration de ${DUMP} dans ${POSTGRES_DB}…"
pg_restore \
  --clean --if-exists --no-owner --no-privileges \
  -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  "${DUMP}"
echo "[initdb] Restauration terminée."
