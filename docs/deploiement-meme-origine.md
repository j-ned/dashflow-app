# Bascule en même origine : `/api` sur le domaine du front

**Avant** : deux origines. Le front est sur `dashflow.nedellec-julien.fr`, l'API sur `api-dashflow.nedellec-julien.fr`, et les deux communiquent via CORS.
**Après** : une seule origine. Traefik envoie `dashflow.nedellec-julien.fr/api/*` au conteneur de l'API en **retirant le préfixe** `/api`. L'API garde donc ses chemins actuels, comme `/auth/login` ou `/health`.

Ce que la bascule apporte :
- **CSP du front :** `connect-src` et `img-src` se réduisent à `'self'`, plus Sentry.
- **Plus de preflight :** le front n'envoie plus de requêtes OPTIONS avant ses appels à l'API.
- **Fin des sous-domaines :** l'API cesse d'être exposée sur son propre sous-domaine. C'est l'étape finale.

Ce qui a déjà changé dans le code :
- **Cookie de session :** il passe en `SameSite=Lax` (au lieu de `None`). Les deux domaines appartiennent au même **site** (`nedellec-julien.fr`), donc le navigateur l'envoie dans les deux configurations. Aucune étape n'impose de coupure.
- **Front :** il appelle `/api`, en prod (via Traefik) comme en dev (via `apps/web/proxy.conf.json`).
- **nginx :** il répond 404 sur `/api/*`, au lieu de renvoyer `index.html`. Une route Traefik manquante se voit ainsi tout de suite.

## Ordre de déploiement

Chaque étape laisse le site fonctionnel. Fais-les dans l'ordre et fais la vérification avant de passer à la suite.

### 1. Déployer la nouvelle image de l'API, sur son domaine actuel

L'image `apps/api/Dockerfile` démarre maintenant l'API Hono. La commande `node dist/main.js` et les migrations ne changent pas. Aucune variable d'environnement n'est à modifier à cette étape.

Vérifications :

```bash
curl -si https://api-dashflow.nedellec-julien.fr/health
```

- **Réponse attendue :** `200 {"ok":true}`, avec les en-têtes de sécurité habituels.
- **Navigation :** l'ancien front, toujours en ligne, doit continuer à fonctionner. Teste une connexion, une page budget et une page médicale.

### 2. Ajouter la route `/api` vers l'API

Dans Dokploy, service **API** → *Domains* → ajoute un domaine avec les réglages suivants :

| Champ | Valeur |
|---|---|
| Host | `dashflow.nedellec-julien.fr` |
| Path | `/api` |
| Strip Path | **activé** |
| Port du conteneur | celui de l'API (`PORT`, 3001 par défaut) |
| HTTPS | activé, même certificat que le front |

Équivalent en labels Traefik, si tu les écris toi-même :

```yaml
traefik.http.routers.dashflow-api.rule: Host(`dashflow.nedellec-julien.fr`) && PathPrefix(`/api`)
traefik.http.routers.dashflow-api.middlewares: dashflow-api-strip
traefik.http.middlewares.dashflow-api-strip.stripprefix.prefixes: /api
```

Traefik donne la priorité à la règle la plus longue. `Host && PathPrefix(/api)` passe donc avant la règle `Host` seule du front, sans réglage de priorité.

Vérification (doit renvoyer `200 {"ok":true}`, et non du HTML) :

```bash
curl -si https://dashflow.nedellec-julien.fr/api/health
```

### 3. OAuth Google : nouvelle URL de retour

1. **Console Google Cloud** → *Identifiants* → le client OAuth → *URI de redirection autorisés* → **ajoute** `https://dashflow.nedellec-julien.fr/api/auth/oauth/google/callback`. Garde l'ancienne URI jusqu'à l'étape 5.
2. **Variables de l'API :** `APP_URL=https://dashflow.nedellec-julien.fr/api`. `CORS_ORIGIN` ne change pas : c'est l'origine du front, utilisée par le contrôle CSRF et pour les liens des mails.
3. **Redéploie l'API.**

### 4. Déployer le front

L'image `apps/web/Dockerfile` appelle `/api` et applique la nouvelle CSP.

Vérifications :
- **Requêtes réseau :** dans les outils de développement, les appels partent vers `https://dashflow.nedellec-julien.fr/api/...`, sans requête OPTIONS.
- **Cookie :** `__Host-dashflow_session` est présent avec `SameSite=Lax`.
- **Parcours complet :** connexion avec mot de passe, avec 2FA, avec Google ; envoi d'un avatar et d'un document ; déconnexion.

### 5. Retirer l'ancien sous-domaine (quand plus aucun client ne l'utilise)

- **Dokploy :** retire le domaine `api-dashflow.nedellec-julien.fr` du service API, ainsi que l'ancienne URI de redirection côté Google.
- **Code (fait le 1er novembre 2026) :** middleware CORS supprimé de l'API et `Cross-Origin-Resource-Policy` à `same-origin`. Plus aucune lecture cross-origin n'est possible.

## Retour arrière

| Étape | Annulation |
|---|---|
| 1 | Redéployer l'image précédente de l'API : même base, mêmes migrations, sessions compatibles. |
| 2–3 | Retirer le domaine `/api` dans Dokploy et remettre `APP_URL` à son ancienne valeur. |
| 4 | Redéployer l'image précédente du front : elle appelle de nouveau `api-dashflow…`, qui fonctionne toujours tant que l'étape 5 n'est pas faite. |
