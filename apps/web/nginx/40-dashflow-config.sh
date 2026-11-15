#!/bin/sh
# Lancé par l'entrypoint de l'image nginx avant le serveur : écrit dans /tmp/dashflow l'adresse
# interne de l'API relayée sous /api/, depuis la variable du conteneur. Une valeur absente ou mal
# formée arrête le démarrage, plutôt qu'un front qui répondrait 502 à chaque appel.
#   API_UPSTREAM  obligatoire, origine interne de l'API, ex. http://dashflow-api:3001
set -eu

fail() { echo "dashflow-config : $1" >&2; exit 1; }

[ -n "${API_UPSTREAM:-}" ] || fail "API_UPSTREAM obligatoire"
# La valeur finit dans la configuration de nginx : seuls les caractères d'une origine simple passent
# (ni guillemet, ni espace, ni point-virgule, ni retour à la ligne).
case "$API_UPSTREAM" in
  *[!A-Za-z0-9.:/_-]*) fail "API_UPSTREAM contient un caractère interdit" ;;
esac
case "$API_UPSTREAM" in
  http://?*|https://?*) ;;
  *) fail "API_UPSTREAM doit commencer par http:// ou https://" ;;
esac
case "${API_UPSTREAM#*://}" in
  */*) fail "API_UPSTREAM : une origine sans chemin attendue (http://hôte:port)" ;;
esac

out=/tmp/dashflow
mkdir -p "$out"
printf 'set $dashflow_api %s;\n' "$API_UPSTREAM" > "$out/api-upstream.conf"
echo "dashflow-config : /api/ relayé vers $API_UPSTREAM"
