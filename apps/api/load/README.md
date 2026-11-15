# Test de charge

Mesure ce que l'application encaisse, sur une pile **jetable** et jamais contre la production :
- **Images :** les mêmes que la production (GHCR).
- **Données :** synthétiques. 200 comptes, avec chacun 5 comptes bancaires, 300 transactions, 10 enveloppes, 3 patients et 18 rendez-vous. Les blobs chiffrés sont factices.
- **CPU bridés** pour approcher le serveur (Intel i3-6100T, 2 cœurs, 4 threads) : 2 pour l'API, 1 pour Postgres.
- **Requêtes :** elles passent par le nginx du front, comme en production.

```bash
apps/api/load/run.sh navigation
apps/api/load/run.sh connexions
apps/api/load/run.sh mixte
```

Pour mesurer une image d'API construite en local : `API_IMAGE=<image> apps/api/load/run.sh mixte`.

Il faut Docker et `openssl`. La pile est supprimée à la fin du test. Le résumé k6 et les relevés CPU et mémoire sont écrits dans `results/`, qui n'est pas versionné.

## Scénarios

- **navigation :** des utilisateurs connectés rechargent en boucle leurs six pages principales (`/auth/me`, comptes, toutes les transactions, enveloppes, patients, rendez-vous), avec 1 à 3 secondes de lecture entre deux tours. Ils montent par paliers à 25, 50, 100 puis 200 en même temps. Chacun s'annonce avec sa propre adresse (`x-load-ip`, lu via `CLIENT_IP_HEADER`), pour que le throttling compte par visiteur comme en production.
- **connexions :** des connexions par mot de passe de plus en plus fréquentes (2, 5, 10, puis 20 par seconde), chacune depuis une adresse différente. Ce scénario mesure le coût d'Argon2, pas le throttling.
- **mixte :** 50 utilisateurs naviguent pendant que les connexions montent jusqu'à 20 par seconde. Ce scénario vérifie que la navigation reste fluide pendant une rafale de connexions. Une connexion refusée en 503 (« serveur occupé ») est une réponse attendue : elle est comptée à part, et l'utilisateur virtuel réessaie au tour suivant.

## Résultats du 15/11/2026 (machine i7-7820HQ, CPU bridés comme ci-dessus)

**Navigation (jusqu'à 200 utilisateurs simultanés)**

| Mesure | Valeur |
|---|---|
| Débit | 211 requêtes par seconde |
| Erreurs | 0 sur 80 888 requêtes |
| Pages : temps médian | 29 ms |
| Pages : p95 et p99 | 215 ms et 271 ms |
| Connexions pendant la montée : p95 | 364 ms |
| CPU de l'API (pic) | 181 % sur 200 % autorisés : proche de la saturation à 200 utilisateurs |
| CPU de nginx (pic) | 126 % (compression gzip des réponses) |
| CPU de Postgres (pic) | 51 % |
| Mémoire API / Postgres | 108 Mo / 116 Mo |

**Connexions**

| Mesure | Valeur |
|---|---|
| Débit maximal tenu | environ **3,4 connexions par seconde** |
| Au-delà | les connexions font la queue : p95 de 56 s, 2 % dépassent le délai de 60 s, 571 abandonnées par k6 |
| CPU de l'API (pic) | 208 %, saturé |
| Mémoire de l'API (pic) | 326 Mo (Argon2 utilise 64 Mo par hash) |

**Mixte : la navigation pendant une rafale de connexions**

| Mesure | Sans limite | 2 hachages simultanés | **1 hachage à la fois** |
|---|---|---|---|
| Pages, p95 | 2,12 s | 1,50 s | **101 ms** |
| Connexions, p95 | 51,6 s | 8,2 s | **3,4 s** |
| Connexions réussies | (file d'attente) | 715 | **1 039** |
| Refus 503 servis en moins d'une seconde | — | 51 % | **100 %** |

Sans limite, la rafale de connexions saturait le CPU et ralentissait toute la navigation. Un seul hachage Argon2 occupe déjà les deux cœurs avec ses 4 voies : en lancer deux à la fois affame le reste de l'API. La limite retenue est donc **un hachage à la fois** (`apps/api/src/auth/password-hashing.ts`).

## Ce qu'il faut en retenir

1. **La navigation tient largement.** Ce scénario est très agressif : un utilisateur virtuel recharge six pages toutes les 2,5 secondes, alors qu'un vrai utilisateur fait plutôt une requête toutes les 5 à 30 secondes. 211 requêtes par seconde avec un p95 de 215 ms représentent donc **plusieurs centaines à quelques milliers d'utilisateurs actifs réels**, à confirmer sur le serveur.
2. **Le premier goulot est Argon2, à la connexion.** Avec les paramètres de production (64 Mo, 3 passes, 4 voies), deux cœurs tiennent environ 3,4 connexions par seconde, soit plus de 12 000 par heure. C'est largement suffisant pour un usage normal, car on se connecte rarement et les sessions durent. Sans protection, **une rafale de connexions venue de nombreuses adresses** saturait le CPU de l'API et ralentissait la navigation des autres utilisateurs. La réponse, sans affaiblir Argon2 : **un seul hachage à la fois**, une file d'attente courte, et un refus immédiat (503 avec `Retry-After`) au-delà. Voir le scénario mixte ci-dessus.
3. **Le CPU est partagé.** Sur le serveur, l'API, nginx et Postgres se partagent 4 threads avec les autres sites. Le pic de navigation demande environ 3,5 threads, donc le serveur serait **à saturation vers 200 utilisateurs virtuels de ce scénario**.
4. **La bande passante est un risque.** La liste complète des transactions pèse environ 150 Ko par appel avant compression. nginx compresse (gzip) quand le client l'accepte, ce que fait Cloudflare. C'est quand même le débit montant de la connexion du serveur qui limitera le plus tôt un afflux réel. La pagination par curseur existe déjà, et le front pourrait demander moins de lignes.

## Limites de la mesure

- La machine de test n'est pas le serveur. Le bridage CPU approche un i3-6100T, sans le reproduire exactement (fréquence, cache, autres sites hébergés).
- Pas de réseau réel : ni tunnel Cloudflare, ni connexion internet du serveur.
- Les données sont synthétiques et les blobs factices. Les volumes, eux, sont réalistes.
- `NODE_ENV=test` : il évite les cookies `Secure` sur du HTTP local. Le reste du code n'en dépend pas.
