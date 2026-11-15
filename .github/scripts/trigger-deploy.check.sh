#!/usr/bin/env bash
# Juge `trigger-deploy.sh` devant un faux Dokploy local protégé comme le vrai : sans jeton d'accès il
# redirige vers une page de connexion (302), avec une mauvaise clé d'API il refuse (401), sinon il
# accepte (200) et note ce qu'il a reçu.
#   .github/scripts/trigger-deploy.check.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="$(mktemp -d)"
PORT=38471

python3 - "$PORT" "$WORK/received" <<'PY' &
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer

port, received = int(sys.argv[1]), sys.argv[2]

class Dokploy(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get('Content-Length', '0'))).decode()
        if self.headers.get('CF-Access-Client-Id') != 'id' or self.headers.get('CF-Access-Client-Secret') != 'secret':
            self.send_response(302)
            self.send_header('Location', 'https://login.invalid/')
        elif self.path != '/api/compose.deploy':
            self.send_response(404)
        elif self.headers.get('x-api-key') != 'good-key':
            self.send_response(401)
        else:
            with open(received, 'w') as f:
                f.write(body)
            self.send_response(200)
        self.end_headers()

    def log_message(self, *args):
        pass

HTTPServer(('127.0.0.1', port), Dokploy).serve_forever()
PY
STUB=$!
trap 'kill "$STUB" 2>/dev/null || true; rm -rf "$WORK"' EXIT
for _ in $(seq 1 50); do
  if curl -s -o /dev/null "http://127.0.0.1:$PORT/" -X POST; then break; fi
  sleep 0.1
done

trigger() {
  env -i PATH="$PATH" DOKPLOY_URL="http://127.0.0.1:$PORT" DOKPLOY_COMPOSE_ID=compose-42 "$@" "$HERE/trigger-deploy.sh" 2>&1
}
fails_with() {
  local expected="$1" output
  shift
  if output="$(trigger "$@")"; then
    echo "succès annoncé alors que Dokploy n'a pas déployé ($expected attendu) : $output" >&2
    exit 1
  fi
  grep -q "$expected" <<<"$output" || { echo "message attendu absent ($expected) : $output" >&2; exit 1; }
  test ! -e "$WORK/received" || { echo "Dokploy a reçu une demande malgré l'échec" >&2; exit 1; }
}

# Sans jeton d'accès : la redirection vers la page de connexion n'est pas un succès.
fails_with 'redirection (302)' DOKPLOY_API_KEY=good-key
# Jeton d'accès faux : même redirection.
fails_with 'redirection (302)' DOKPLOY_API_KEY=good-key CF_ACCESS_CLIENT_ID=id CF_ACCESS_CLIENT_SECRET=faux
# Clé d'API refusée.
fails_with 'refusé (401)' DOKPLOY_API_KEY=mauvaise-clé CF_ACCESS_CLIENT_ID=id CF_ACCESS_CLIENT_SECRET=secret
# Variable obligatoire absente : rien n'est tenté.
fails_with 'DOKPLOY_API_KEY' CF_ACCESS_CLIENT_ID=id CF_ACCESS_CLIENT_SECRET=secret

output="$(trigger DOKPLOY_API_KEY=good-key CF_ACCESS_CLIENT_ID=id CF_ACCESS_CLIENT_SECRET=secret)"
grep -q 'accepté le déploiement (200)' <<<"$output" || { echo "succès non annoncé : $output" >&2; exit 1; }
test "$(cat "$WORK/received")" = '{"composeId": "compose-42"}' || { echo "corps reçu inattendu : $(cat "$WORK/received")" >&2; exit 1; }
! grep -q 'good-key\|secret' <<<"$output" || { echo "secret dans la sortie" >&2; exit 1; }

echo "trigger-deploy.sh : redirection, refus et variable absente échouent, l'acceptation réussit."
