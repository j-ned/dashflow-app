#!/usr/bin/env bash
# Juge l'image de sauvegarde de bout en bout, devant un Postgres et un stockage S3 (MinIO) jetables :
# une base témoin est sauvegardée, l'objet envoyé est chiffré, puis restauré dans une base vide dont
# le contenu doit être identique. Une mauvaise phrase ne restaure rien. Même script en CI et en local,
# après `docker build -t j-ned-app-backup:ci deploy/backup`.
#   deploy/backup/check.sh [image]
set -euo pipefail

IMAGE="${1:-j-ned-app-backup:ci}"
NETWORK=dashflow-backup-ci
DB=dashflow-backup-db
S3=dashflow-backup-s3
BUCKET=backups

cleanup() {
  docker rm -f "$DB" "$S3" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker network create "$NETWORK" >/dev/null
docker run -d --name "$DB" --network "$NETWORK" \
  -e POSTGRES_PASSWORD=it -e POSTGRES_DB=source postgres:18-alpine >/dev/null
docker run -d --name "$S3" --network "$NETWORK" \
  -e MINIO_ROOT_USER=backup-check -e MINIO_ROOT_PASSWORD=backup-check-secret \
  cgr.dev/chainguard/minio:latest server /data >/dev/null

# Client S3 du test : le curl de l'image jugée, signé comme le fait `backup.sh`.
s3() {
  docker run --rm --network "$NETWORK" --entrypoint curl "$IMAGE" \
    --fail --silent --show-error --aws-sigv4 'aws:amz:auto:s3' \
    --user backup-check:backup-check-secret -H 'x-amz-content-sha256: UNSIGNED-PAYLOAD' "$@"
}

for _ in $(seq 1 60); do
  if docker exec "$DB" psql -U postgres -d source -c 'select 1' >/dev/null 2>&1; then break; fi
  sleep 1
done
for _ in $(seq 1 60); do
  if s3 -X PUT "http://$S3:9000/$BUCKET" >/dev/null 2>&1; then break; fi
  sleep 1
done
s3 "http://$S3:9000/$BUCKET?list-type=2" >/dev/null

psql_db() { docker exec -i "$DB" psql -U postgres -v ON_ERROR_STOP=1 -At "$@"; }
psql_db -d source <<'SQL' >/dev/null
create table article (id int primary key, title text not null);
insert into article select n, 'Article témoin ' || n from generate_series(1, 500) as n;
create index article_title on article (title);
SQL
psql_db -d postgres -c 'create database restored' -c 'create database refused' >/dev/null

# Variables de `RUN_ENV` posées après les autres : elles les remplacent, le temps d'un cas d'erreur.
RUN_ENV=()
run() {
  local database="$1" passphrase="$2"
  shift 2
  docker run --rm --network "$NETWORK" \
    -e PGHOST="$DB" -e PGUSER=postgres -e PGPASSWORD=it -e PGDATABASE="$database" \
    -e BACKUP_S3_ENDPOINT="http://$S3:9000" -e BACKUP_S3_BUCKET="$BUCKET" \
    -e BACKUP_S3_ACCESS_KEY=backup-check -e BACKUP_S3_SECRET_KEY=backup-check-secret \
    -e BACKUP_PASSPHRASE="$passphrase" "${RUN_ENV[@]}" "$IMAGE" "$@"
}

# Un refus du stockage échoue en nommant sa cause : sans elle, un 403 ne dit pas s'il faut corriger
# la clé, les droits du jeton ou le nom du bucket.
refused_with() {
  local expected="$1" output
  shift
  RUN_ENV=("$@")
  if output="$(run source 'phrase de test' once 2>&1)"; then
    echo "sauvegarde acceptée alors qu'elle devait être refusée ($expected)" >&2
    exit 1
  fi
  RUN_ENV=()
  grep -q "$expected" <<<"$output" || {
    echo "cause du refus absente du message ($expected attendu) : $output" >&2
    exit 1
  }
  ! grep -q 'backup-check-secret\|clé-fausse' <<<"$output" || { echo "clé secrète dans le message" >&2; exit 1; }
}
refused_with SignatureDoesNotMatch -e BACKUP_S3_SECRET_KEY=clé-fausse
refused_with NoSuchBucket -e BACKUP_S3_BUCKET=bucket-absent

run source 'phrase de test' once
object="$(s3 "http://$S3:9000/$BUCKET?list-type=2" | sed -n 's/.*<Key>\([^<]*\)<\/Key>.*/\1/p')"
test -n "$object" || { echo "aucun objet dans le bucket" >&2; exit 1; }

# L'objet stocké est chiffré : ni l'en-tête de pg_dump ni une donnée en clair.
s3 "http://$S3:9000/$BUCKET/$object" >/tmp/dashflow-backup-object
! grep -q 'PGDMP' /tmp/dashflow-backup-object || { echo "dump stocké en clair" >&2; exit 1; }
! grep -q 'Article témoin' /tmp/dashflow-backup-object || { echo "donnée en clair dans l'objet" >&2; exit 1; }
rm -f /tmp/dashflow-backup-object

run restored 'phrase de test' restore "$object"
fingerprint() { psql_db -d "$1" -c "select count(*), md5(string_agg(id || ':' || title, ',' order by id)) from article"; }
test "$(fingerprint source)" = "$(fingerprint restored)" || { echo "contenu restauré différent de la source" >&2; exit 1; }
test "$(psql_db -d restored -c "select count(*) from pg_indexes where indexname = 'article_title'")" = "1" || {
  echo "index non restauré" >&2
  exit 1
}

if run refused 'mauvaise phrase' restore "$object" >/dev/null 2>&1; then
  echo "restauration acceptée avec une mauvaise phrase" >&2
  exit 1
fi
test "$(psql_db -d refused -c "select count(*) from pg_tables where tablename = 'article'")" = "0" || {
  echo "base modifiée malgré une mauvaise phrase" >&2
  exit 1
}

echo "Image $IMAGE : sauvegarde chiffrée, restauration identique et refus d'une mauvaise phrase vérifiés."
