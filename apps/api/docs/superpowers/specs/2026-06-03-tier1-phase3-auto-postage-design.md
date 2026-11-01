# Tier 1 « effet Money » — Phase 3 : Auto-postage « Échéances à confirmer »

**Date :** 2026-06-03
**Statut :** Design validé, prêt pour planification
**Repo concerné :** `dash-flow` (front). Aucun changement backend ni schéma.
**Prérequis :** Phases 1 & 2 livrées (registre `account_transactions`, gateway, moteur `confirmedBalance`/`isRecurrencePosted`, dashboard confirmé/projeté avec `isUnposted`).

## Contexte & problème

Le solde projeté (Phase 2) suppose que toute récurrence non postée reste « à venir ». Tant qu'aucun moyen ne pose `recurringEntryId` sur une transaction réelle, l'utilisateur qui saisit manuellement une transaction dupliquant une récurrence provoque un double comptage. La Phase 3 ferme la boucle : un panneau « Échéances à confirmer » transforme une récurrence échue en transaction réelle (qui porte son `recurringEntryId`), ce qui l'exclut automatiquement de la projection.

## Décisions (brainstorming 2026-06-03)

| Décision | Choix |
|---|---|
| Périmètre des échéances | Récurrences `income`/`expense`/`transfer` **avec `dayOfMonth`**, échues dans le cycle (`isExpensePassed`) et non postées ce mois (`isUnposted`). Exclut `annual_expense` (prévision annuelle) et `spending` (ad hoc). |
| Placement | **Haut de la page Compte** (`/budget/account`), au-dessus de la grille KPI, filtré sur le compte sélectionné (ou tous). |
| Confirmer | Crée une transaction réelle portant `recurringEntryId`, datée à l'échéance du mois, montant pré-rempli **éditable**. |
| Ignorer | Report d'affichage **session-only** (set de `recurringEntryId` ignorés, pas de persistance). |

## Architecture

### View-model `PendingCharge`
```
{ entry: RecurringEntry; direction: 'income' | 'expense' | 'transfer'; suggestedDate: string; suggestedAmount: number }
```
- `direction` : income→income, expense→expense, transfer→transfer.
- `suggestedDate` = `${currentMonth}-${dayOfMonth.padStart(2,'0')}` (échéance du mois).
- `suggestedAmount` = `entry.amount`.

### Logique (dans `bank-account.ts`, intégration en place)
- `pendingCharges` computed : récurrences `income`/`expense`/`transfer` avec `dayOfMonth`, `isExpensePassed(e)` ET `isUnposted(e)`, hors set `_ignoredCharges`, mappées en `PendingCharge`. Filtré au compte sélectionné (déjà le cas via `filteredEntries`/`transfers`).
- `confirmCharge(id, amount)` : `txGateway.create(accountId, { amount, direction, date: suggestedDate, toAccountId: entry.toAccountId, category: entry.category, note: null, memberId: entry.memberId, recurringEntryId: entry.id })` puis `refreshTx()`.
- `confirmAllCharges()` : boucle sur `pendingCharges()` (montant suggéré) puis un `refreshTx()` final.
- `ignoreCharge(id)` : ajoute au `_ignoredCharges` signal.
- **`allTx` rendu rechargeable** : pattern `_refreshTx` + `toObservable(_refreshTx).pipe(switchMap(() => getAll()))` (identique à `allEntries`/`_refresh`), `refreshTx()` incrémente.

### Composant dumb `PendingChargesPanel`
`pages/bank-account/pending-charges-panel/pending-charges-panel.ts` :
- `input charges: PendingCharge[]`, `input accountNameById: (id: string|null) => string|null` (libellés virement).
- `output confirm: { id: string; amount: number }`, `confirmAll: void`, `ignore: string`.
- Montant éditable par ligne : signal local seedé via `linkedSignal` depuis `charges`.
- `charges` vide → ne rend rien (panneau masqué).
- OnPush, signals, classes token existantes.

### i18n
Clés fr/en sous `budget.bankAccount.pending` : `title` (« Échéances à confirmer »), `confirm`, `confirmAll`, `ignore`, `dueOn` (« échéance du {{date}} »).

## Effet sur la dette Phase 2
Une fois une échéance confirmée, sa transaction porte `recurringEntryId` → `isRecurrencePosted` la détecte → elle est exclue de `forecastDelta` → plus de double comptage. La boucle de réconciliation est fermée.

## Tests
- **Panel** (dumb spec) : rend N lignes ; émet `confirm` avec le montant édité ; émet `ignore`.
- **bank-account.spec** : `pendingCharges` inclut une dépense récurrente échue+non postée ; exclut une postée ; exclut une ignorée. `confirmCharge` appelle `create` avec `recurringEntryId` + recharge.
- **Suite complète** + smoke navigateur (démo : panneau visible avec échéances passées ; confirmer une → solde confirmé bouge, échéance disparaît ; ignorer une → disparaît).

## Hors périmètre
- `annual_expense`/`spending` dans le panneau.
- Persistance des « ignorées ».
- Plan 4 (import OFX/CSV). Différés : unification catégories, migration virements ponctuels, bug i18n mois.
