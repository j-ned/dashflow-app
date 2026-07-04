# Fix — POST /salary-archives plante en multipart (archivage cassé)

**Date** : 2026-07-04
**Repo** : `nest-dashflow-app` (backend NestJS). Front inchangé.
**Statut** : design approuvé, prêt pour le cycle (qa → implementer → reviewer)
**Sévérité** : l'archivage salarial (auto « Nouveau cycle » ET manuel) est **cassé pour tous les utilisateurs** (démo et comptes réels), pas seulement la démo. Révélé par un smoke prod sur le compte démo (500).

## Root cause (tracé de bout en bout)

Le front poste **toujours** l'archive en `multipart/form-data` : `HttpSalaryArchiveGateway.create()` appelle `api.postForm()` = `http.post(url, FormData)`, dans la branche démo (`if (!key) return postForm(data)`) **comme** dans la branche chiffrée (FormData avec `encryptedData` + clés claires). `postForm` n'envoie jamais de JSON.

Côté back, `SalaryArchivesController` hérite de `OwnedCrudController.create(@CurrentUser() u, @Body() body)` — **aucun interceptor multer** n'est appliqué sur ce POST (le seul `FileInterceptor` du fichier est sur le sous-route `:id/payslip`, et il n'existe pas de multer global dans `main.ts`). Un body `multipart/form-data` n'est donc **pas parsé** → `@Body()` vaut `undefined` → `toCreateValues(undefined)` lit `undefined.encryptedData` → `TypeError: Cannot read properties of undefined (reading 'encryptedData')` → **500** (`salary-archives.controller.ts:42`).

Deux conséquences du même défaut :
1. **Body non parsé** (cause du 500) — multer absent sur `create`.
2. **`spendings` en string** — en mode clair, le front fait `fd.append('spendings', JSON.stringify(spendings))`. Même une fois le multipart parsé, `spendings` arrive comme **string JSON**, or `createSalaryArchiveSchema.spendings` attend `z.array(...)` → échec de validation (400) après le premier fix. (En mode chiffré ce champ est dans `encryptedData`, opaque — non concerné.)

Note : le front attache la fiche de paie sous le champ **`payslip`** au `create` manuel (`salary-archives.ts:410`, `if (this._selectedFile) fd.append('payslip', this._selectedFile)`). Le `create` doit donc tolérer un fichier `payslip` optionnel sans le perdre.

## Faits établis

- `toCreateValues` (controller) gère **déjà** les deux modes : `if (body.encryptedData)` (chiffré, `month/salary` placeholders) sinon clair (`parseBody(createSalaryArchiveSchema, body)`). Le mode clair est légitime (compte démo = données en clair, cf. autres entités qui marchent sur démo). **Ne pas** toucher cette logique de branchement.
- DTO : `createSalaryArchiveSchema` (clair : month, salary, totalExpenses, totalSpendings, spendings, accountId) et `createEncryptedSalaryArchiveSchema` (accountId, encryptedData). `salary`/`totalExpenses`/`totalSpendings` = `z.union([string, number]).transform(String)` → déjà OK pour du multipart (string).
- `storage.payslipKey(userId, id, mimetype)` + `storage.upload(key, buffer, mimetype)` existent déjà (utilisés par le sous-route `uploadPayslip`).

## Changements (backend uniquement)

### 1. `SalaryArchivesController` — surcharger `create` avec parsing multipart

Surcharger `create` (aujourd'hui hérité) pour appliquer multer et gérer un payslip optionnel :

```ts
@UseGuards(CsrfGuard)
@Post()
@HttpCode(201)
@UseInterceptors(FileInterceptor('payslip', { limits: { fileSize: 10 * 1024 * 1024 } }))
override async create(
  @CurrentUser() u: AuthUser,
  @Body() body: Record<string, unknown>,
  @UploadedFile() file?: { buffer: Buffer; mimetype: string },
) {
  const row = (await this.svc.create(u.id, this.toCreateValues(body))) as { id: string };
  if (!file) return row;
  const key = this.storage.payslipKey(u.id, row.id, file.mimetype);
  await this.storage.upload(key, file.buffer, file.mimetype);
  return this.svc.update(u.id, row.id, { payslipKey: key });
}
```

`FileInterceptor('payslip')` fait que multer parse **les champs texte du multipart dans `@Body()`** (même sans fichier), ce qui résout le 500 pour les deux modes (clair et chiffré). Le fichier optionnel est uploadé et référencé, cohérent avec ce que le front envoie et avec le sous-route existant.

### 2. `createSalaryArchiveSchema.spendings` — coercition string JSON → array

En multipart, `spendings` arrive en string. Coercer avant validation, sans casser le mode JSON (si un jour un vrai array est passé) :

```ts
spendings: z
  .preprocess((v) => {
    if (typeof v !== 'string') return v;
    try { return JSON.parse(v); } catch { return v; } // string invalide → laisse échouer proprement en 400, pas 500
  }, z.array(z.unknown()))
  .optional()
  .default([]),
```

## Hors périmètre (YAGNI)

- **Incohérence front `file` vs `payslip`** : en mode chiffré, `HttpSalaryArchiveGateway.create` cherche `data.get('file')` alors que le manuel append `payslip` → le payslip chiffré au create ne partirait pas. **Bug front séparé**, non traité ici (ce fix est back-only ; le bug rapporté — archivage démo — n'a pas de payslip).
- Pas de refonte d'`OwnedCrudController` (le fix est local à `SalaryArchivesController`).
- Pas de changement du sous-route `:id/payslip` (conservé pour ajout/remplacement ultérieur).

## Tests (cycle jned-team RED → GREEN → review)

Niveau **module + supertest** (`salary-archives.controller.spec.ts`, `Test.createTestingModule` avec `SalaryArchivesService` et `StorageService` mockés, guards `JwtAuthGuard`/`CsrfGuard` overridés en pass-through — voir `patients.controller.spec.ts` / `auth.controller.spec.ts` comme modèles). Reproduire le **vrai multipart HTTP** via `request(app.getHttpServer()).post('/salary-archives').field(...)` :

1. **RED du 500 — mode clair** : POST multipart avec `month=2026-06`, `salary=1500`, `spendings=<json string>` (sans fichier) → **201** (avant fix : 500). Vérifier que `svc.create` est appelé avec `month='2026-06'` et `spendings` = **array** (coercition OK), pas la string.
2. **Mode chiffré** : POST multipart avec `encryptedData=<blob>` + `accountId` → 201, `svc.create` appelé avec `month:'0000-00'`, `salary:'0'`, `encryptedData` présent.
3. **Payslip optionnel** : POST multipart avec un fichier `payslip` (`.attach('payslip', buffer, 'p.pdf')`) → `storage.upload` appelé, `svc.update` appelé avec `{ payslipKey }`, 201.
4. **Non-régression garde** : POST sans cookie/CSRF invalide → 401/403 (les guards restent actifs sur le create surchargé).

Lancer `pnpm test` (Vitest + swc, pas d'intégration DB requise pour ces tests module) et prouver 100% vert.

## Fichiers touchés
- `src/modules/salary-archives/salary-archives.controller.ts` (surcharge `create`)
- `src/modules/salary-archives/dto/salary-archive.dto.ts` (coercition `spendings`)
- `src/modules/salary-archives/salary-archives.controller.spec.ts` (nouveau, tests module/supertest)
