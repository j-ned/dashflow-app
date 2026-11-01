# Tier 1 « effet Money » — Phase 2 : Bascule du dashboard (réconciliation prévu ↔ réel)

**Date :** 2026-06-03
**Statut :** Design validé, prêt pour planification
**Repo principal concerné :** `dash-flow` (front Angular). Aucun changement backend ni de schéma.
**Prérequis :** Phase 1 « Socle & Relevé » livrée (table `account_transactions`, gateway `AccountTransactionGateway`, moteur `domain/account-balance.ts` avec `confirmedBalance`/`isRecurrencePosted`).

## Contexte & problème

Le dashboard `bank-account.ts` (834 l.) calcule aujourd'hui ses deux soldes **uniquement à partir des `recurring_entries`** (prévisionnel) :
- `currentBalance` (l. 484) = initial + revenus + virements entrants passés − dépenses passées − annuel/12 − spending du mois.
- `endOfMonthBalance` (l. 491) = initial + revenus + virements entrants − charges du mois − annuel/12 − spending − virements sortants.

Aucune notion de transaction réelle. La Phase 1 a introduit un registre de transactions réelles + un moteur `confirmedBalance`, exploités jusqu'ici uniquement par la page Relevé. La Phase 2 fait **converger le dashboard** vers le modèle « réel = vérité, prévu = projection du futur ».

## Décisions (brainstorming 2026-06-03)

| Décision | Choix |
|---|---|
| Périmètre Phase 2 | **Uniquement la bascule du solde dashboard.** Unification des catégories (clé vs label) et migration des virements ponctuels → **différées** (plans ultérieurs). |
| Présentation | **Deux soldes reframés** : `currentBalance` → « Solde confirmé » (réel à ce jour) ; `endOfMonthBalance` → « Projeté (fin de mois) ». Même emplacement, libellés clarifiés, changement de layout minimal. |
| Approche d'intégration | **Intégration en place** (pas d'extraction complète de la prévision dans le domaine). Le composant reste le siège de la logique de prévision (qu'il maîtrise déjà) ; le domaine fournit les deux primitives réelles (`confirmedBalance`, `isRecurrencePosted`). YAGNI : on ne ré-implémente pas la logique annuel/12 + spending + ponctuels déjà tissée dans les signals. |

## Architecture

### Modèle de réconciliation

- `confirmedBalance` = solde initial + Σ transactions **réelles** du compte à ce jour (fonction de domaine Phase 1).
- `projectedBalance` = `confirmedBalance + forecastDelta`, où `forecastDelta` = la formule actuelle de `endOfMonthBalance` **moins le solde initial** (= delta des récurrences seul), chaque somme de récurrence **excluant celles déjà postées** ce mois.

Pas de double comptage du solde initial : `confirmedBalance` le porte déjà ; `forecastDelta` n'apporte que le delta des récurrences.

### Intégration dans `bank-account.ts`

1. **Source réelle** : injecter `AccountTransactionGateway` ; `allTx = toSignal(gateway.getAll(), { initialValue: [] })` ; computed `accountRealTxs` = transactions touchant le compte sélectionné (`t.accountId === id || t.toAccountId === id`), comme le Relevé. Mode « Tous les comptes » (`selectedAccountId === null`) : agrégat sur tous les comptes (cohérent avec le bouton existant).

2. **`confirmedBalance` (nouveau computed)** = `confirmedBalance(selectedAccount, accountRealTxs(), today)` → libellé « Solde confirmé ». Remplace l'ancien `currentBalance` et toute sa logique passé-de-récurrences.

3. **`projectedBalance` (nouveau computed)** = `confirmedBalance() + forecastDelta()`. `forecastDelta` reprend les sommes existantes (`totalIncome + totalIncoming − totalMonthlyExpenses − monthlyAnnualExpenses − totalMonthSpendings − totalOutgoing`) **sans le terme initial**, chaque somme filtrée par un helper unique `isUnposted(entry)` = `!isRecurrencePosted(entry.id, moisCourant, accountRealTxs())`.

4. **Libellés** : les deux affichages de solde (`bank-kpi-grid` + en-tête) passent à « Solde confirmé » / « Projeté (fin de mois) » via clés i18n fr/en. Les KPIs budgétaires (`usagePercent`, jauges) restent **inchangés** (budget vs prévision = concern séparé, hors scope).

### Unité de changement

- Toucher **uniquement** les définitions `currentBalance`→`confirmedBalance` et `endOfMonthBalance`→`projectedBalance`, et ajouter le filtre `isUnposted` aux sommes de récurrences. Les sommes de base (`totalIncome`, etc.) et les KPIs restent intacts.
- Un seul helper `isUnposted(entry)` réutilisé partout où une somme de récurrences alimente le projeté (cohérence).

## Limitation assumée (dépendance Plan 3)

Tant que l'auto-postage (Plan 3) n'existe pas, aucune transaction réelle ne porte de `recurringEntryId` → `isRecurrencePosted` est toujours faux → projeté = confirmé + **toutes** les récurrences.
- Utilisateurs **sans transaction réelle** (cas actuel + démo) : confirmé = initial, projeté = **exactement l'ancien prévisionnel** → **zéro régression**.
- Seul cas gênant : saisir **manuellement** une transaction réelle dupliquant une récurrence (ex. « Loyer 800 » à la main) → loyer compté deux fois dans le projeté. **Résolu par le Plan 3** (confirmer une échéance pose le `recurringEntryId`). Documenté comme dette Plan 2→3.

## Tests

- **Domaine** : aucun ajout (`confirmedBalance`/`isRecurrencePosted` couverts en Phase 1).
- **Composant** (TestBed, gateways stubbés avec comptes + récurrences + transactions réelles) :
  1. **Non-régression** : zéro transaction réelle → `projectedBalance()` == ancien `endOfMonthBalance` (même valeur).
  2. **Confirmé** : transactions réelles → `confirmedBalance()` = initial ± réel.
  3. **Exclusion des postées** : une récurrence avec une transaction réelle de même `recurringEntryId` ce mois → exclue de `forecastDelta` (pas de double comptage).
- **Tests existants** assertant l'ancien `currentBalance` : mettre à jour **délibérément** (vérifier les nouvelles valeurs attendues, pas juste « rendre vert »).
- **Suite front complète** + **smoke navigateur** (démo : dashboard montre « confirmé » + « projeté » ; ajouter une transaction au Relevé → confirmé du dashboard bouge).

## Risques

- `bank-account.ts` intriqué (834 l.) ; nombreux dépendants (`bank-kpi-grid`, `bank-timeline`, jauges). **Mitigation** : changement chirurgical des seules deux définitions de solde + filtre `isUnposted` ; ne pas toucher les sommes de base ni les KPIs.
- Risque d'incohérence du filtre `isUnposted` → un seul helper réutilisé.
- Sémantique de tests qui change → mise à jour réfléchie.

## Hors périmètre (plans ultérieurs)

- **Plan 3** : auto-postage « Échéances à confirmer » (`PendingChargesPanel`) — pose `recurringEntryId`, résout la limitation ci-dessus.
- **Plan 4** : import OFX/CSV + endpoint batch.
- **Différés** : unification du vocabulaire de catégories (clé vs label — dette de la revue Phase 1) ; migration des virements ponctuels (`recurring_entries` type transfer → `account_transactions`).
