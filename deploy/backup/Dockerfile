# syntax=docker/dockerfile:1.7

# Sauvegarde de la base : mêmes outils clients que le serveur (postgres:18), curl pour l'envoi signé
# vers le bucket, gpg pour le chiffrement. Contexte de build : ce dossier.
FROM postgres:18-alpine

RUN apk add --no-cache curl gnupg

COPY --chmod=0555 backup.sh /usr/local/bin/backup.sh

# Utilisateur sans privilège de l'image.
USER postgres

ENTRYPOINT ["/usr/local/bin/backup.sh"]
CMD ["loop"]
