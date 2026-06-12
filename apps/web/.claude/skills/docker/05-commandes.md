# Commandes Docker — Reference

## Images
```bash
docker build -t myapp:1.0 .                 # construire
docker build -t myapp --target production .  # cibler un stage
docker build --no-cache -t myapp .           # sans cache
docker buildx build --platform linux/amd64,linux/arm64 -t myapp . # multi-platform
docker images                                # lister
docker rmi myapp:1.0                         # supprimer
docker tag myapp:1.0 registry/myapp:1.0      # tagger
docker push registry/myapp:1.0               # pousser
docker pull nginx:alpine                     # telecharger
docker image prune                           # nettoyer les images pendantes
```

## Containers
```bash
docker run -d --name myapp -p 3000:3000 myapp:1.0  # demarrer en background
docker run -it --rm node:22-alpine sh              # shell interactif temporaire
docker run -e NODE_ENV=production myapp             # avec variable d'env
docker run -v $(pwd)/data:/app/data myapp           # avec volume
docker run --network mynet myapp                    # sur un reseau specifique
docker ps                                          # containers actifs
docker ps -a                                       # tous les containers
docker stop myapp                                  # arreter
docker start myapp                                 # demarrer
docker restart myapp                               # redemarrer
docker rm myapp                                    # supprimer
docker rm -f myapp                                 # forcer la suppression
docker logs -f myapp                               # suivre les logs
docker logs --tail 100 myapp                       # derniers 100 lignes
docker exec -it myapp sh                           # shell dans un container actif
docker inspect myapp                               # details du container
docker stats                                       # utilisation ressources
docker cp myapp:/app/file.txt ./file.txt           # copier un fichier
```

## Volumes
```bash
docker volume create mydata          # creer
docker volume ls                     # lister
docker volume inspect mydata         # details
docker volume rm mydata              # supprimer
docker volume prune                  # nettoyer les volumes inutilises
```

## Reseaux
```bash
docker network create mynet          # creer
docker network ls                    # lister
docker network inspect mynet         # details
docker network connect mynet myapp   # connecter un container
docker network disconnect mynet myapp # deconnecter
docker network rm mynet              # supprimer
docker network prune                 # nettoyer
```

## Nettoyage
```bash
docker system df                     # espace utilise
docker system prune                  # nettoyer (containers arretes, images pendantes, reseaux)
docker system prune -a               # + images non utilisees
docker system prune -a --volumes     # + volumes (ATTENTION)
```

## Debug
```bash
docker logs myapp 2>&1 | grep error  # chercher dans les logs
docker inspect --format='{{.State.Health}}' myapp  # etat healthcheck
docker top myapp                     # processus dans le container
docker diff myapp                    # fichiers modifies
docker history myapp:1.0             # historique des layers
```
