# Tier 1 « effet Money » — Phase 4 : Import CSV

**Date :** 2026-06-03
**Statut :** Design validé, prêt pour planification
**Repos :** `dash-flow` (front, gros) + `nest-dashflow-app` (back, endpoint batch + migration nulle).
**Prérequis :** Phases 1-3 (registre `account_transactions`, gateway E2EE, moteur, Relevé, auto-postage).

## Contexte

Saisir manuellement chaque mouvement est fastidieux. L'import d'un relevé bancaire CSV peuple le registre en lot. E2EE strict ⇒ **parsing 100% front** (le fichier n'est jamais envoyé au serveur), transactions chiffrées client-side, **un seul POST batch**.

## Décisions (brainstorming 2026-06-03)

| Décision | Choix |
|---|---|
| Format | **CSV** uniquement (assistant de mapping colonnes). Parser maison, sans dépendance. OFX différé. |
| Flux | Assistant modal 3 étapes : fichier+compte → mapping colonnes → **revue+confirmation** (dédup + catégories éditables) → import batch. |
| Dédup | Empreinte `date|montant|libellé-fold` vs transactions réelles existantes du compte → doublons **décochés par défaut**. |
| Catégorisation | Auto-suggestion par règles mot-clé sur le libellé → code référentiel, surchargeable ; fallback `other`. |
| Écriture | On **revoit avant d'écrire** (cohérent avec l'auto-postage). |

## Architecture

### Domaine (front, pur, testable sans TestBed)
- **`domain/csv-import.ts`** :
  - `parseCsv(text): { headers: string[]; rows: string[][] }` — détection séparateur `,`/`;`, gestion guillemets.
  - `parseAmount(raw): number` — gère `1 234,56` / `1234.56` / signe / parenthèses comptables.
  - `parseDate(raw, format): string` — `'YYYY-MM-DD'`, formats `DD/MM/YYYY`/`YYYY-MM-DD`/`MM/DD/YYYY`.
  - `mapRows(rows, mapping): ParsedTransaction[]` — `mapping = { dateCol; labelCol; amountMode: {kind:'signed';col} | {kind:'debitCredit';debitCol;creditCol}; dateFormat }`. Sortie `{ date; label; amount (positif); direction:'income'|'expense' }`.
- **`domain/import-dedup.ts`** : `fingerprint(t)`, `markDuplicates(parsed, existing): (ParsedTransaction & {duplicate:boolean})[]`.
- **`domain/import-categorize.ts`** : `suggestCategory(label): string` (clé référentiel via règles mot-clé, fallback `'other'`).
- Type `ParsedTransaction` dans `domain/models/parsed-transaction.model.ts`.

### Backend
- `POST /bank-accounts/:accountId/transactions/batch` (JWT+CSRF) — body `{ items: BatchItem[] }`, chaque item comme le create unitaire (E2EE: `{encryptedData, direction, toAccountId?, memberId?, recurringEntryId?}` ; clair: champs complets). DTO Zod `batchTransactionSchema` (array, max 1000). Service `addBatch(userId, accountId, items)` : vérifie la propriété **une fois**, insert N en une requête, retourne les lignes.

### Front gateway
- `createBatch(accountId, items: NewTransaction[]): Observable<AccountTransaction[]>` — si clé E2EE : `Promise.all(items.map(encryptEntity(_, CLEARTEXT_KEYS, key)))` puis `POST .../batch { items: encrypted }` ; sinon POST direct. (Pas de déchiffrement des réponses requis — on recharge la liste après.)

### UI — assistant `CsvImportWizard`
Composant (`pages/transactions/csv-import-wizard/`) dans une `app-modal-dialog`, 3 étapes signal (`step`), ouvert depuis un bouton « Importer un relevé » du Relevé :
1. `<input type=file accept=".csv">` (FileReader → texte) + select compte cible.
2. Selects de mapping (date/libellé/montant ou débit-crédit, format date) + aperçu 3 lignes.
3. Tableau revue : date, libellé, montant, direction, catégorie (select éditable), case à cocher (doublons décochés). Bouton « Importer N transactions » → `createBatch(accountId, lignesCochées)` → fermeture + reload du Relevé.

## Tests
- Domaine pur : `parseCsv` (`,`/`;`, guillemets), `parseAmount` (virgule/point/signe), `parseDate` (3 formats), `mapRows` (signed + débit-crédit), `markDuplicates`, `suggestCategory` (règles + fallback).
- Backend : `addBatch` (ownership refusé → undefined ; insert N).
- Front gateway : `createBatch` plaintext (POST array) + E2EE (chaque item chiffré, `amount` absent en clair).
- Composant : mapping → preview → import appelle `createBatch` avec les lignes cochées seulement.
- Smoke : importer un petit CSV démo → aperçu/dédup/catégories → import → solde confirmé bouge.

## Phasage
- T1 : `domain/csv-import.ts` + type + spec.
- T2 : `domain/import-dedup.ts` + `import-categorize.ts` + specs.
- T3 : backend batch (DTO+service+controller+spec) + front gateway `createBatch` (interface + impl + spec).
- T4 : `CsvImportWizard` + intégration Relevé + i18n.
- T5 : build + suite + smoke.

## Hors périmètre
- OFX. Catégories utilisateur. Unification vocabulaire catégories (clé vs label — dette). Migration virements ponctuels. Bug i18n mois.
