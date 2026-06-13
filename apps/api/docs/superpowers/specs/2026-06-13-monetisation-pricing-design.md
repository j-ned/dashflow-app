# Monétisation DashFlow — Pricing, Entitlements, Stripe & Admin

- **Date** : 2026-06-13
- **Statut** : Design validé (brainstorming) — prêt pour plan d'implémentation Phase 0
- **Repos concernés** : `nest-dashflow-app` (back NestJS/Drizzle), `dash-flow` (front Angular 20). Repos séparés, jamais de monorepo.

## 1. Objectif

Ajouter une couche de monétisation complète à DashFlow (app E2EE budget + santé famille) :

1. Une gamme de **3 plans** (1 gratuit, 2 payants) avec des options cohérentes.
2. Un **paiement réel** via Stripe Checkout + webhooks.
3. Un **feature gating** back + front : les options se débloquent selon le plan acheté.
4. Un **dashboard admin** pour vérifier l'état de paiement des users et faire des overrides (SAV).

### Principes structurants

- **Le back est la seule autorité.** Le front cache/verrouille pour l'UX ; toute route protégée revérifie côté serveur.
- **Entitlements découplés de Stripe.** Stripe est *une* source d'entitlement, pas le cœur. Permet override admin + future autre source.
- **Le gating lit des capacités (`features`) et quotas (`limits`), jamais le nom du plan.** Les plans sont de la data.
- **Dégradation douce, jamais de coupure brutale** : un abonnement expiré/annulé retombe sur le plan gratuit `solo`.
- **E2EE préservé.** L'admin ne voit que des métadonnées de facturation. Aucun accès aux données budget/santé chiffrées.
- **Verrouillage doux** des features vendables : visibles mais grisées + badge discret → pricing. Pas de pop-up agressive ni de masquage.

## 2. Catalogue (3 plans)

| Capacité | **Solo** (gratuit) | **Famille** — 6,99 €/mois | **Famille + Santé** — 11,99 €/mois |
|---|---|---|---|
| Domaine Budget | Base | Complet | Complet |
| Comptes bancaires | 1 | ∞ | ∞ |
| Membres famille | 1 (soi) | ∞ | ∞ |
| Partage famille (`shared-access`) | ❌ | ✅ | ✅ |
| Transactions / catégories / relevé | ✅ | ✅ | ✅ |
| Enveloppes, prêts, salaires, récurrents | ❌ | ✅ | ✅ |
| Imports CSV (OFX plus tard) | ❌ | ✅ | ✅ |
| Analytics / prévisions | Mois courant | Avancées | Avancées |
| Domaine Santé (RDV, médics, ordonnances, praticiens…) | ❌ | ❌ | ✅ |
| Stockage documents (R2) — *médical, lié à un patient* | ❌ | ❌ | 10 Go |
| Support | — | Standard | Prioritaire |

### Capabilities (lues par le code de gating)

`budget.core`, `budget.advanced` (enveloppes/prêts/salaires/récurrents), `budget.import`, `family.sharing`, `analytics.forecast`, `medical.access`, `storage.documents`.

### Limits (quotas)

`bankAccounts`, `members`, `storageBytes`.

### Mapping plan → entitlement (catalogue en code)

```
solo          → features: ['budget.core']
                 limits:   { bankAccounts: 1, members: 1, storageBytes: 0 }
family        → features: ['budget.core','budget.advanced','budget.import',
                           'family.sharing','analytics.forecast']
                 limits:   { bankAccounts: ∞, members: ∞, storageBytes: 1 Go }
                 stripePriceId: env STRIPE_PRICE_FAMILY
family_health → features: family + ['medical.access','storage.documents']
                 limits:   { bankAccounts: ∞, members: ∞, storageBytes: 10 Go }
                 stripePriceId: env STRIPE_PRICE_FAMILY_HEALTH
```

`∞` = absence de limite (valeur sentinelle, ex. `null`). Le catalogue vit dans un fichier `plan-catalog.ts`, dupliqué proprement back et front (repos séparés).

## 3. Modèle de données (migrations Drizzle, back)

1. **`users.role`** — enum `'user' | 'admin'`, défaut `'user'`. Mis à `admin` à la main en base sur le compte propriétaire. Aucune UI pour s'auto-promouvoir.
2. **`subscriptions`** — 1 ligne par user, source de vérité de l'entitlement :
   - `userId` (FK, unique)
   - `planKey` : `'solo' | 'family' | 'family_health'`
   - `status` : `'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'`
   - `source` : `'free' | 'stripe' | 'admin'`
   - `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `cancelAtPeriodEnd`
   - `createdAt`, `updatedAt`
3. **`stripe_events`** — idempotence des webhooks : `eventId` (unique), `type`, `processedAt`.

### Résolution de l'entitlement effectif

Service unique `EntitlementService.resolve(user) → { planKey, features[], limits{} }` :

- Pas de ligne `subscriptions`, ou `status ∈ {canceled, past_due expiré}` → retombe sur **`solo`**.
- `status ∈ {active, trialing}` → features/limits du `planKey`.
- `source = 'admin'` → ignore Stripe, applique le plan tel quel (override SAV).

Exposé via `GET /me/entitlements`, consommé par le back (gating) et le front (UI).

### Seed / migration de données

- Tous les users existants → `solo`.
- Compte démo → `family_health` avec `source: 'admin'` (vitrine montrant tout).
- Compte propriétaire → `role: 'admin'`.

## 4. Flux Stripe (Checkout + webhooks)

### Setup (hors code, une fois)

Dans Stripe : 2 produits → 2 prices mensuels. Env back :
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_FAMILY`, `STRIPE_PRICE_FAMILY_HEALTH`. Rien de secret côté front.

### Souscrire

1. Front : `POST /billing/checkout-session { planKey }`.
2. Back : crée/réutilise `stripeCustomerId`, ouvre une **Checkout Session** (mode `subscription`, `price_id` du plan, `success_url`/`cancel_url`), renvoie l'`url`.
3. Front : redirige vers Stripe. Aucune donnée carte ne touche le serveur (pas de charge PCI).

### Activation via webhook `POST /billing/webhook`

- Vérifie la **signature** (`STRIPE_WEBHOOK_SECRET`). Endpoint public mais signé, **exclu des guards JWT/CSRF**.
- **Idempotence** : `event.id` déjà dans `stripe_events` → `200` et stop.
- Events → upsert `subscriptions` :
  - `checkout.session.completed` / `customer.subscription.created|updated` → planKey (déduit du `price_id`), `status`, `currentPeriodEnd`, `cancelAtPeriodEnd`.
  - `customer.subscription.deleted` → `status: 'canceled'` (EntitlementService dégradera vers `solo`).
  - `invoice.payment_failed` → `status: 'past_due'`.

### Gérer / annuler

`POST /billing/portal` → URL du **Stripe Customer Portal** (changement de plan, annulation, moyens de paiement, factures gérés par Stripe). Aucune UI de facturation à construire.

### Dév local

`stripe listen --forward-to localhost:3000/billing/webhook` (Stripe CLI).

## 5. Gating

### Back (NestJS) — autorité

1. **Capability guard** — `@RequiresFeature('medical.access')` + `FeatureGuard` lisant l'entitlement résolu → **403** si absent. Appliqué sur :
   - `medical/*` → `medical.access`
   - imports → `budget.import`
   - enveloppes / prêts / salaires / récurrents → `budget.advanced`
   - partage → `family.sharing`
2. **Limit check** — `assertWithinLimit('bankAccounts', count)` dans les services de création avant insert → **402 Payment Required** avec code `LIMIT_REACHED`. Idem `members`, et `storageBytes` à l'upload de documents.

### Front (Angular 20, signals d'abord)

- `EntitlementService` charge `GET /me/entitlements` au login → signal `entitlement()` + helpers `can('medical.access')`, `limitOf('bankAccounts')`.
- **Route guard** `featureGuard('medical.access')` (CanMatch) → si pas le droit, redirige vers la **page paywall** (pas 404), avec `returnUrl`.
- **Directive** `*appRequiresFeature="'budget.import'"` → verrouillage doux : bouton visible grisé + badge « Famille » (tooltip), clic → pricing.
- **Interceptor HTTP** : 402 `LIMIT_REACHED` → toast + paywall ciblé.
- Compte démo : mappé `family_health` (`source: 'admin'`) pour tout montrer.

## 6. Dashboard admin

Route `/admin` (front) + module `admin` (back), gardés par le rôle admin : back `RolesGuard` + `@Roles('admin')` (403 sinon), front `adminGuard` (CanMatch). Invisible pour un user normal.

### Vue « Utilisateurs » (table)

Colonnes : email · plan effectif · statut · **source** (badge `stripe`/`admin`/`free`) · fin de période · date d'inscription · compte démo ?
Filtres : par plan, par statut, recherche email. Tri date / statut.
« A payé » = `source = 'stripe'` ET `status ∈ {active, trialing}`.

### Actions admin

- **Override de plan** : attribuer/révoquer un plan à la main (`source: 'admin'`). Tracé.
- Lien direct vers le client dans Stripe.
- (Optionnel) **Resync** d'un user depuis l'API Stripe si un webhook a été raté.

### Bandeau métriques

Nb users par plan · abonnements actifs · en essai · en `past_due` · **MRR estimé**.

### Endpoints

`GET /admin/users` (paginé + filtres), `PATCH /admin/users/:id/plan`, `GET /admin/metrics`, `POST /admin/users/:id/resync` (optionnel).

### E2EE

La table n'expose que des métadonnées de facturation. Aucun accès aux données chiffrées (impossible sans la clé de l'user, non ajoutée).

## 7. Roadmap (phases, chacune testable & déployable)

| Phase | Contenu | Démontrable |
|---|---|---|
| **0 — Socle entitlements (back)** | Migrations `role`/`subscriptions`/`stripe_events`, `plan-catalog.ts`, `EntitlementService.resolve()` + dégradation `solo`, `GET /me/entitlements`, seeds (users→solo, démo→family_health admin, owner→admin). | TDD pur, aucune UI. |
| **1 — Gating back** | `FeatureGuard` + `@RequiresFeature`, `assertWithinLimit` (comptes/membres/stockage), codes `LIMIT_REACHED`/403, appliqués sur medical/imports/budget avancé/partage. | API = autorité, testé endpoint par endpoint. |
| **2 — Entitlements & gating front** | `EntitlementService` (signal), `featureGuard` (routes), directive `*appRequiresFeature` (verrouillage doux + badge), page paywall, gestion 402/409 interceptor. Plan vient des seeds/overrides. | Démontrable sans payer. |
| **3 — Page Pricing** | 3 cartes, design soigné (skill `impeccable`). CTA branchés en Phase 4. | Visuel. |
| **4 — Stripe** | `POST /billing/checkout-session`, webhook signé + idempotent, `POST /billing/portal`, câblage CTA → Checkout, tests webhook (events simulés), Stripe CLI local. | Paiement réel. |
| **5 — Dashboard admin** | `RolesGuard`/`@Roles`, `GET /admin/users` + filtres, `PATCH .../plan`, `GET /admin/metrics`, route `/admin` + `adminGuard`, table + métriques (design `impeccable`). | Supervision. |

### Méthode

Chaque phase suit le cycle AAK : `architect` → `qa` (RED) → `angular-expert`/back (GREEN) → `code-reviewer`. TDD strict. Repos séparés. Pas de commit auto (l'utilisateur commit). Gates = build + test + knip (pas `lint`, qui reformate tout le repo back).

## 8. Hors périmètre (YAGNI pour l'instant)

- Annuel / réductions (-20 %) : ajoutable plus tard (price IDs + toggle).
- OFX (CSV d'abord).
- Essais gratuits Stripe (le tier `solo` gratuit fait office d'entrée).
- Facturation/TVA personnalisée (Stripe gère).
- Multi-devise (EUR seul).

## 9. Risques & points d'attention

- **Webhook raté** → entitlement désync. Mitigé par : idempotence, action admin `resync`, dégradation douce.
- **Sécurité du gating** : ne jamais se fier au front. Tests back sur chaque route protégée et chaque limite.
- **Migration des users existants** : seed `solo` obligatoire pour ne casser personne.
- **Compte démo** : doit rester `family_health` après reset (cf. logique de reset démo existante à mettre à jour).
- **Dette migrations NestJS** connue (drizzle-kit migrate au boot) : `DROP ... IF EXISTS` idempotent, migrations commitées.
