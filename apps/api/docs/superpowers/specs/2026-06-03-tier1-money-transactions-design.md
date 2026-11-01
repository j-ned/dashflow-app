# Tier 1 « effet Money » — Registre de transactions + catégories structurées

**Date :** 2026-06-03
**Statut :** Design validé, prêt pour planification
**Repos concernés :** `nest-dashflow-app` (backend NestJS) + `dash-flow` (front Angular), repos séparés.

## Contexte & problème

DashFlow est aujourd'hui un **tableau prévisionnel** : le solde d'un compte est *recalculé côté front* à partir des `recurring_entries`, qui sont des **modèles prévisionnels** (loyer du 5, salaire, etc.), pas des faits comptables. Il existe `envelope_transactions` et `loan_transactions`, mais **aucun registre de mouvements pour `bank_accounts`**. Les catégories sont un `varchar(100)` libre adossé à une liste figée (`categories.ts`, lot A2).

Le Tier 1 transforme le prévisionnel en **comptabilité réelle** : un registre de transactions par compte + une taxonomie de catégories structurée. C'est la brique fondatrice qui fait basculer DashFlow de tableau prévisionnel à vrai gestionnaire de finances.

## Décisions structurantes

| Décision | Choix | Conséquence |
|---|---|---|
| Confidentialité | **E2EE strict maintenu** | Serveur aveugle (coffre de blobs). Toute l'intelligence (soldes, agrégats, parsing import, postage) vit **côté front**. Zéro régression de confidentialité, cohérent avec envelopes/loans. Pas de rapports/recherche/cron serveur. |
| Périmètre | **Les 4 briques** (registre, catégories, auto-postage, import) | Séquencées en **3 phases** d'implémentation, pas en big-bang. |
| Catégories | **Référentiel typé en code** | Taxonomie figée dans `categories.ts` étendu (groupes + sous-catégories + icône/couleur). Pas de table, pas d'E2EE pour les catégories. La transaction stocke un *code*. Limite assumée : pas de catégories utilisateur. |
| Réconciliation prévu ↔ réel | **Réel = vérité, prévu = projection du futur** | Le solde courant/passé = `initialBalance + Σ transactions réelles`. Les récurrences ne projettent plus que le futur. Une récurrence postée cesse de compter comme prévision pour ce mois (anti-double-comptage). |
| Auto-postage | **Suggéré + confirmation** | E2EE = pas de cron serveur ; le front détecte les échéances échues non postées et propose « Échéances à confirmer » (montant pré-rempli, ajustable). Évite d'écrire de la fausse donnée comptable. |

## Architecture

### Modèle de données — nouvelle table `account_transactions`

E2EE, calquée sur `envelope_transactions` / `loan_transactions` (cleartext keys vs blob `encryptedData`).

| Colonne | Type | Rôle |
|---|---|---|
| `id` | uuid pk | |
| `userId` | uuid → users (cascade) | scoping propriété |
| `accountId` | uuid → bank_accounts (cascade) | compte rattaché |
| `amount` | numeric(12,2) | montant **positif** (convention app existante) |
| `direction` | enum `transaction_direction` (`income`/`expense`/`transfer`) | sens comptable réel |
| `toAccountId` | uuid → bank_accounts (set null) | destination si `transfer` |
| `date` | date | date du mouvement (cleartext, tri + bucket mensuel) |
| `category` | varchar(100) | **code** du référentiel |
| `note` | varchar(255) | **chiffré** (hors cleartext keys, comme la note de prêt) |
| `memberId` | uuid → patients (set null) | optionnel, comme recurring_entries |
| `recurringEntryId` | uuid → recurring_entries (set null) | **provenance** : posté depuis quelle récurrence |
| `encryptedData` | text | blob E2EE |
| `createdAt` | timestamptz | |

Points clés :
- **Anti-double-postage sans colonne redondante** : une récurrence est « postée pour le mois M » ⟺ il existe une transaction avec `recurringEntryId = R` et `month(date) = M`. Le `postedPeriod` se **dérive de `date`**.
- **Direction explicite** (`income`/`expense`/`transfer`) plutôt que réutiliser `recurring_entry_type` : `annual_expense`/`spending` sont des concepts *prévisionnels*, pas des faits. Solde réel = `initialBalance + Σ income − Σ expense ± transfers`.
- **Wire E2EE** : on suit exactement le pattern existant ; `note` chiffrée, `date`/`amount`/FK structurelles en clair (tri/réconciliation après `decryptList`).
- **Migration `0004_*`** via le pipeline Drizzle en place (enum `transaction_direction` + table). ⚠️ Ordre prod : adoption baseline (si pas faite) → `migrate` (applique 0004) → déployer le backend.

### Taxonomie catégories

Extension de `features/budget/domain/categories.ts` (pas de table) : groupes (Logement, Alimentation, Transport, Abonnements, Revenus, Santé, Loisirs…) → sous-catégories, chacune `{ label, icon, color, group }`, type `CategoryCode`. `normalizeCategory` (existant, tolérant accents/casse) mappe les anciennes valeurs libres des `recurring_entries`. Partagée par transactions + récurrences + import + analytics.

### Moteur de solde & réconciliation (front)

Module pur et testable `features/budget/domain/account-balance.ts` :

```
confirmedBalance(account, txs)      // initialBalance + Σ income − Σ expense ± transfers, txs date ≤ aujourd'hui
projectedBalance(account, txs, recurrences, horizon)
                                    // confirmedBalance + Σ récurrences non postées jusqu'à l'horizon
monthReconciliation(month, txs, recurrences)
                                    // par récurrence du mois : { posted, txId?, prévu, réel }
```

Règle anti-double-comptage :
- Récurrence dont l'échéance du mois est **postée** → déjà dans `confirmedBalance`, ne compte plus comme prévision.
- Récurrence échue **non postée** → reste en « à venir », alimente la projection + le panneau « Échéances à confirmer ».

Dashboard :
- **Solde confirmé** (réel, transactions passées) = nouvelle vérité affichée.
- **Projeté fin de mois / horizon** = confirmé + récurrences restantes non postées (distinction visuelle confirmé vs à venir).
- **Reste à vivre** = projeté fin de mois.

**Vue « Relevé » par compte** : liste chronologique (montant signé selon `direction`, catégorie icône/couleur du référentiel, badge provenance si issue d'une récurrence), filtres mois/catégorie/membre, CRUD manuel.

**Refactor ciblé `bank-account.ts`** : `sumAmount` / `decoratedAccounts` / calcul de solde basé récurrences remplacés/complétés par les fonctions ci-dessus. Les virements ponctuels (`bank-transfers-panel`) deviennent des transactions `transfer`. ⚠️ Piège Angular : exposer les fonctions importées en champ `protected` pour le template.

### Auto-postage « Échéances à confirmer »

- Au chargement : `dueRecurrences` = récurrences `dayOfMonth ≤ aujourd'hui` (mois courant) **et** non postées ce mois.
- Composant **`PendingChargesPanel`** : par ligne → libellé, **montant pré-rempli éditable**, date, catégorie héritée. Actions : Confirmer / Confirmer tout / Ignorer (report d'affichage, pas de persistance d'un état « ignoré »).
- Confirmer → crée une `account_transaction` (`recurringEntryId` renseigné, `accountId` de la récurrence, `direction` dérivée du `type` : income→income, expense/annual_expense/spending→expense, transfer→transfer).
- **Idempotent** : dédup par `recurringEntryId` + mois.

### Import OFX/CSV (phase 3)

- Parser **côté front** (OFX SGML / CSV + mini-assistant de mapping). Parse → candidats → **dédup** (empreinte date+montant+libellé) → **catégorisation auto** suggérée (règles libellé adossées au référentiel, surchargeable) → insertion en lot.
- Backend : endpoint **`POST /bank-accounts/:id/transactions/batch`** (chaque blob chiffré côté front, un seul POST).
- Plus gros morceau, dépend du socle + catégories → dernière phase, **sous-spec/plan dédiée** au moment venu.

### Backend — module `account-transactions`

Controller → service → repository (token `DRIZZLE`), blobs E2EE, scoping `userId`+`accountId`, DTO Zod aux frontières (jamais l'entité Drizzle nue). Endpoints :
- `GET /bank-accounts/:id/transactions`
- `GET /transactions/all` (dashboard global, comme loans)
- `POST /bank-accounts/:id/transactions`
- `PUT /transactions/:id`
- `DELETE /transactions/:id`
- `POST /bank-accounts/:id/transactions/batch` (phase 3)

## Phasage d'implémentation

Trois plans séquencés, chacun buildable + vérifiable :

- **Phase 1 — Socle** : migration `0004` + backend module + gateway front (crypto-transport, specs plaintext **et** E2EE) + taxonomie catégories + CRUD manuel « Relevé » + moteur de réconciliation + bascule dashboard vers solde confirmé/projeté.
- **Phase 2 — Auto-postage** : `PendingChargesPanel` + flux de confirmation + dédup.
- **Phase 3 — Import OFX/CSV** : parser + dédup + catégorisation + endpoint batch.

## Tests

- **Backend** Vitest : module (faux `DrizzleDB` via token `DRIZZLE`), contrat e2e supertest.
- **Front** : gateway E2EE + plaintext (comme l'existant), **moteur de réconciliation en tests de fonctions pures**, composants relevé/panel.
- **Smoke** navigateur via compte démo.

## Pièges & contraintes (intégrés)

- E2EE wire-compatible : `note` dans le blob, ne jamais casser le schéma `encryptedData`.
- Coercition `Number()` sur les numériques branche plaintext (postgres renvoie des string).
- `date.toISOString()` dans tout `sql\`...${date}...\`` brut (crash bind postgres-js sinon).
- Ordre migration prod : baseline → migrate → deploy (sinon SELECT sur colonne absente = 500 ou crash-loop).
- « members » = table `patients` (memberId → patients.id).
- Commits délégués : back + front séparés, **jamais de push** ; l'utilisateur commit lui-même.

## Hors périmètre

- Catégories utilisateur en DB (référentiel code uniquement).
- Auto-postage automatique sans confirmation.
- Rapports / recherche / agrégation côté serveur (incompatibles E2EE strict).
- Gating Free/Premium, paiement Stripe.
