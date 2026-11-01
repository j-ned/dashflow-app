#!/usr/bin/env bash
# Copie la base de production du VPS (Dokploy) dans la base Neon de Vercel, puis vérifie que
# chaque table a exactement le même nombre de lignes des deux côtés.
#
#   NEON_DATABASE_URL='<DATABASE_URL_UNPOOLED de Vercel>' make db-to-neon
#
# - Source : le dump le plus récent de ~/backups/dashflow (fais d'abord `make db-pull`, PENDANT la
#   fenêtre de maintenance, une fois l'ancienne API arrêtée : sinon les écritures qui suivent le
#   dump sont perdues).
# - Cible : la connexion DIRECTE de Neon (DATABASE_URL_UNPOOLED), pas le pooler.
# - Refuse une cible qui contient déjà des données (FORCE=1 pour passer outre, en connaissance de
#   cause). pg_restore tourne dans postgres:18 (Docker) : aucune installation locale requise.
# - L'URL n'apparaît jamais en argument de commande (elle passe par l'environnement du conteneur).
set -euo pipefail

: "${NEON_DATABASE_URL:?Définis NEON_DATABASE_URL (DATABASE_URL_UNPOOLED du projet Vercel)}"
BACKUP_DIR="${HOME}/backups/dashflow"
PG_IMAGE="postgres:18"

DUMP="$(ls -1t "${BACKUP_DIR}"/*.dump 2>/dev/null | head -1 || true)"
if [ -z "${DUMP}" ]; then
  echo "Erreur : aucun dump dans ${BACKUP_DIR}. Lance d'abord 'make db-pull'." >&2
  exit 1
fi
echo "Dump source : ${DUMP} ($(du -h "${DUMP}" | cut -f1), $(date -r "${DUMP}" '+%d/%m %H:%M'))"

neon() { docker run --rm -i --network host -e PGURL="${NEON_DATABASE_URL}" "${PG_IMAGE}" sh -c "$1"; }

EXISTING="$(neon 'psql "$PGURL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = '"'"'public'"'"'"')"
if [ "${EXISTING// /}" != "0" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "Erreur : la base Neon contient déjà ${EXISTING// /} table(s) publique(s). FORCE=1 pour écraser." >&2
  exit 1
fi

echo "Restauration dans Neon…"
neon 'pg_restore --no-owner --no-privileges --clean --if-exists --exit-on-error -d "$PGURL"' < "${DUMP}"

COUNTS_SQL="SELECT string_agg(t, ' ' ORDER BY t) FROM (
  SELECT format('%s=%s', table_name,
    (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM public.%I', table_name), false, true, '')))[1]::text) AS t
  FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE') s;"

echo "Comparaison des volumes (VPS ↔ Neon)…"
SOURCE="$(ssh "${DASHFLOW_SSH_HOST:-homeserver}" 'CID=$(docker ps -qf name=dashflow-database); \
  docker exec -i "$CID" sh -c "PGPASSWORD=\"\$POSTGRES_PASSWORD\" psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tA"' <<< "${COUNTS_SQL}")"
TARGET="$(neon 'psql "$PGURL" -tA' <<< "${COUNTS_SQL}")"

if [ "${SOURCE}" == "${TARGET}" ]; then
  echo "OK : volumes identiques sur $(wc -w <<< "${TARGET}") tables."
  tr ' ' '\n' <<< "${TARGET}" | sed 's/^/  /'
else
  echo "ÉCART entre la source et Neon :" >&2
  diff <(tr ' ' '\n' <<< "${SOURCE}") <(tr ' ' '\n' <<< "${TARGET}") >&2 || true
  echo "(Normal seulement si l'ancienne API a reçu des écritures après le dump.)" >&2
  exit 1
fi
