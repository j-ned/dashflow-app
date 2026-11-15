#!/usr/bin/env bash
# Demande à Dokploy de redéployer la pile (`compose.deploy`), puis vérifie qu'il a accepté : seule une
# réponse 2xx vaut succès. Une redirection (page de connexion de Cloudflare Access devant le panneau)
# ou un refus font échouer la commande, au lieu de laisser croire à un déploiement.
#   DOKPLOY_URL, DOKPLOY_API_KEY, DOKPLOY_COMPOSE_ID : obligatoires
#   CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET : jeton de service Cloudflare Access, si le panneau
#   est protégé par Access
set -euo pipefail

: "${DOKPLOY_URL:?}" "${DOKPLOY_API_KEY:?}" "${DOKPLOY_COMPOSE_ID:?}"

response="$(mktemp)"
trap 'rm -f "$response"' EXIT

# En-têtes d'authentification lus sur l'entrée standard : ils n'apparaissent pas dans la ligne de
# commande.
headers() {
  printf 'header = "x-api-key: %s"\n' "$DOKPLOY_API_KEY"
  if [ -n "${CF_ACCESS_CLIENT_ID:-}" ] && [ -n "${CF_ACCESS_CLIENT_SECRET:-}" ]; then
    printf 'header = "CF-Access-Client-Id: %s"\n' "$CF_ACCESS_CLIENT_ID"
    printf 'header = "CF-Access-Client-Secret: %s"\n' "$CF_ACCESS_CLIENT_SECRET"
  fi
}

status="$(headers | curl --silent --show-error --max-time 30 --config - \
  --output "$response" --write-out '%{http_code}' \
  -X POST "$DOKPLOY_URL/api/compose.deploy" \
  -H 'Content-Type: application/json' \
  -d "{\"composeId\": \"$DOKPLOY_COMPOSE_ID\"}")"

case "$status" in
  2*)
    echo "Dokploy a accepté le déploiement ($status)."
    ;;
  3*)
    echo "::error::Dokploy n'a pas été atteint : redirection ($status). Le panneau est sans doute derrière Cloudflare Access : vérifier CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET et la règle Service Auth de l'application." >&2
    exit 1
    ;;
  401 | 403)
    echo "::error::Déploiement refusé ($status) : vérifier DOKPLOY_API_KEY, ou le jeton de service Cloudflare Access." >&2
    exit 1
    ;;
  *)
    echo "::error::Dokploy a répondu $status : vérifier DOKPLOY_URL et DOKPLOY_COMPOSE_ID." >&2
    exit 1
    ;;
esac
