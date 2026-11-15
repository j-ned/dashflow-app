#!/usr/bin/env bash
# Test de charge de bout en bout, sur une machine de développement (jamais contre la production) :
# pile jetable (compose.yaml) avec les images de production, données synthétiques (seed.sql),
# puis un scénario k6 (scenario.js) mesuré à travers le nginx du front.
#   apps/api/load/run.sh [navigation|connexions|mixte]   (défaut : navigation)
# Autre image d'API : API_IMAGE=<image> apps/api/load/run.sh …
# La pile est supprimée à la fin, données comprises. Le résumé k6 est écrit dans
# apps/api/load/results/<scénario>-<date>.json.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIO="${1:-navigation}"
USERS="${USERS:-200}"
PASSWORD='mot-de-passe-de-charge-0123'
COMPOSE=(docker compose -f "$HERE/compose.yaml")

# Secrets à usage unique : la pile ne vit que le temps du test.
LOAD_DB_PASSWORD="$(openssl rand -hex 16)"
LOAD_JWT_SECRET="$(openssl rand -hex 32)"
export LOAD_DB_PASSWORD LOAD_JWT_SECRET

cleanup() { "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Une image locale (API_IMAGE=…) n'existe pas dans le registre : elle est utilisée telle quelle.
"${COMPOSE[@]}" pull --quiet --ignore-pull-failures api web
"${COMPOSE[@]}" up -d --wait db redis
"${COMPOSE[@]}" up -d api web

echo "Attente de l'API (migrations)…"
for _ in $(seq 1 90); do
  curl -sf -o /dev/null http://127.0.0.1:8088/api/health && break
  sleep 1
done
curl -sf -o /dev/null http://127.0.0.1:8088/api/health

# Même algorithme et mêmes paramètres Argon2 que la production : le hash vient de l'image de l'API.
HASH="$("${COMPOSE[@]}" exec -T api node -e \
  "require('argon2').hash('$PASSWORD').then((h) => process.stdout.write(h))")"
"${COMPOSE[@]}" exec -T db psql -U dashflow -d dashflow -X -q \
  -v users="$USERS" -v hash="'$HASH'" <"$HERE/seed.sql"

mkdir -p "$HERE/results"
OUT="results/$SCENARIO-$(date -u +%Y%m%dT%H%M%SZ).json"

# Échantillons CPU/mémoire des conteneurs pendant le test, toutes les 10 s.
( while sleep 10; do
    docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' \
      dashflow-load-api-1 dashflow-load-db-1 dashflow-load-web-1 2>/dev/null
    echo '--'
  done ) >"$HERE/${OUT%.json}.stats.txt" &
STATS=$!

status=0
docker run --rm --network host --user "$(id -u):$(id -g)" -v "$HERE:/load" -w /load \
  grafana/k6:1.4.0 run --quiet \
  -e SCENARIO="$SCENARIO" -e USERS="$USERS" --summary-export "/load/$OUT" scenario.js || status=$?
kill "$STATS" 2>/dev/null || true

echo "Résumé : $HERE/$OUT"
exit "$status"
