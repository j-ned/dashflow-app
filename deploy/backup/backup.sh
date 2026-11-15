#!/bin/sh
# Sauvegarde de la base de DashFlow vers un bucket S3 (Cloudflare R2 ou compatible), hors du serveur.
#   backup.sh loop             (défaut) une sauvegarde par jour à BACKUP_HOUR_UTC (3 h UTC)
#   backup.sh once             une sauvegarde tout de suite
#   backup.sh restore <objet>  télécharge, déchiffre et restaure l'objet dans la base désignée par
#                              PGHOST/PGUSER/PGPASSWORD/PGDATABASE, qui doit exister et être vide
# Dump au format personnalisé de pg_dump, chiffré par gpg (AES-256, phrase BACKUP_PASSPHRASE) avant
# de quitter le conteneur. La durée de conservation se règle sur le bucket (règle de cycle de vie).
set -eu

: "${PGHOST:?}" "${PGUSER:?}" "${PGPASSWORD:?}" "${PGDATABASE:?}"
: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_BUCKET:?}"
: "${BACKUP_S3_ACCESS_KEY:?}" "${BACKUP_S3_SECRET_KEY:?}" "${BACKUP_PASSPHRASE:?}"
HOUR="${BACKUP_HOUR_UTC:-3}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# État de gpg dans le dossier de travail : rien ne survit au conteneur.
export GNUPGHOME="$WORK/gnupg"
mkdir -m 700 "$GNUPGHOME"

# Phrase lue sur un descripteur : elle n'apparaît ni dans la ligne de commande ni dans un fichier.
encrypt() {
  gpg --batch --quiet --symmetric --cipher-algo AES256 --pinentry-mode loopback \
    --passphrase-fd 3 --output "$2" "$1" 3<<EOF
$BACKUP_PASSPHRASE
EOF
}

decrypt() {
  gpg --batch --quiet --decrypt --pinentry-mode loopback \
    --passphrase-fd 3 --output "$2" "$1" 3<<EOF
$BACKUP_PASSPHRASE
EOF
}

# Requête S3 signée (AWS v4) par curl : `s3 <fichier de réponse> <arguments de curl>`. Les clés passent
# par un fichier de configuration lu sur l'entrée standard, pas par la ligne de commande. Un refus du
# stockage échoue en nommant sa cause (`SignatureDoesNotMatch`, `AccessDenied`, `NoSuchBucket`…) : un
# code HTTP seul ne dit pas s'il faut corriger la clé, les droits du jeton ou le nom du bucket.
s3() {
  response="$1"
  shift
  status="$(curl --silent --show-error --retry 3 --aws-sigv4 'aws:amz:auto:s3' \
    -H 'x-amz-content-sha256: UNSIGNED-PAYLOAD' --config - \
    --output "$WORK/s3-response" --write-out '%{http_code}' "$@" <<EOF
user = "$BACKUP_S3_ACCESS_KEY:$BACKUP_S3_SECRET_KEY"
EOF
  )" || return 1
  case "$status" in
    2*)
      mv "$WORK/s3-response" "$response"
      return 0
      ;;
  esac
  cause="$(grep -oE '<(Code|Message)>[^<]*' "$WORK/s3-response" | sed 's/<[^>]*>//' | tr '\n' ' ' || true)"
  echo "$(date -u +%FT%TZ) stockage S3 : requête refusée ($status) ${cause:-sans détail}" >&2
  rm -f "$WORK/s3-response"
  return 1
}

backup_once() {
  name="dashflow-$(date -u +%Y%m%dT%H%M%SZ).dump.gpg"
  pg_dump --format=custom --no-owner --no-privileges --file "$WORK/dump"
  encrypt "$WORK/dump" "$WORK/$name"
  s3 "$WORK/upload-response" --upload-file "$WORK/$name" "$BACKUP_S3_ENDPOINT/$BACKUP_S3_BUCKET/$name"
  echo "$(date -u +%FT%TZ) sauvegarde envoyée : $name ($(wc -c <"$WORK/$name") octets)"
  rm -f "$WORK/dump" "$WORK/$name" "$WORK/upload-response"
}

restore() {
  object="${1:?usage: backup.sh restore <objet>}"
  s3 "$WORK/restore.gpg" "$BACKUP_S3_ENDPOINT/$BACKUP_S3_BUCKET/$object"
  decrypt "$WORK/restore.gpg" "$WORK/restore.dump"
  pg_restore --no-owner --no-privileges --exit-on-error --dbname "$PGDATABASE" "$WORK/restore.dump"
  echo "$(date -u +%FT%TZ) restauration terminée : $object dans $PGDATABASE"
}

seconds_until_next_run() {
  now="$(date -u +%s)"
  wait=$(( (HOUR * 3600 - now % 86400 + 86400) % 86400 ))
  [ "$wait" -gt 0 ] || wait=86400
  echo "$wait"
}

case "${1:-loop}" in
  once) backup_once ;;
  restore) restore "${2:-}" ;;
  loop)
    while :; do
      sleep "$(seconds_until_next_run)"
      # Un échec est journalisé et la boucle continue : la sauvegarde du lendemain reste due.
      backup_once || echo "$(date -u +%FT%TZ) sauvegarde en échec" >&2
    done
    ;;
  *)
    echo "usage: $0 loop | once | restore <objet>" >&2
    exit 2
    ;;
esac
