# Phase B6 — Storage R2 (uploads)

**Date :** 2026-05-31
**Repo :** `nest-dashflow-app`
**Statut :** approuvé, prêt pour plan d'implémentation
**Dépend de :** B1 (auth, guards), B5a/b/c (modules portant les colonnes url/key)

## Contexte

Câblage du stockage de fichiers sur **Cloudflare R2** (S3-compatible) et portage des
sous-routes fichier reportées en B5. Les fichiers sont chiffrés **côté client** (E2EE) ;
le serveur ne fait que stocker/servir des blobs. Port fidèle de `dash-flow/backend/src/storage/s3.ts`
adapté à R2 + **bucket unique** (préfixes).

## Décisions de cadrage

- **R2** via `@aws-sdk/client-s3` (`endpoint` R2, `region:'auto'`, `forcePathStyle:true`).
- **Bucket unique** `S3_BUCKET` (ex. `dashflow-app`) + préfixes `avatars/`,
  `prescriptions/`, `documents/`, `payslips/` (clés Hono déjà préfixées → port direct).
- **Download = streaming via backend** (bucket privé, ownership serveur, compatible E2EE).
- Creds R2 dans `.env` (gitignoré). Variables **optionnelles** en dev : app boote sans,
  routes upload → **503** propre si non configuré.

## Architecture

- **`StorageModule`** `@Global` (`src/storage/storage.module.ts`) → fournit `StorageService`.
- **`StorageService`** (`src/storage/storage.service.ts`) :
  - `S3Client` lazy (ou construit au boot depuis `ConfigService`) ; lance/renvoie un état
    "non configuré" si `S3_ENDPOINT`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`/`S3_BUCKET`
    manquent → le controller traduit en `ServiceUnavailableException` (503).
  - `upload(key, body: Buffer, contentType): Promise<void>` (`PutObjectCommand`,
    CacheControl adapté : avatars `public, max-age=31536000, immutable` ; autres
    `private, max-age=86400`).
  - `getStream(key): Promise<{ stream: Readable; contentType: string } | null>`
    (`GetObjectCommand`, `Body` en stream Node ; null si absent/erreur).
  - `delete(key): Promise<void>` (non-bloquant, ignore l'erreur).
  - Key builders (port s3.ts) : `avatarKey(userId, ct)`, `prescriptionKey(userId, id, ct)`,
    `documentKey(userId, id, ct)`, `payslipKey(userId, id, ct)` (ext dérivée du contentType,
    `jpeg→jpg`, défaut `pdf` / `jpg` pour avatar).
- **Env** (`env.schema.ts`) : `S3_ENDPOINT?`, `S3_REGION` (défaut `'auto'`),
  `S3_ACCESS_KEY_ID?`, `S3_SECRET_ACCESS_KEY?`, `S3_BUCKET?`.
- **Multipart** : `@nestjs/platform-express` `FileInterceptor('file'|'avatar'|'payslip'|'document')`
  en `memoryStorage`, limites (`avatar` 2 Mo, docs/payslips 10 Mo) ; `@UploadedFile()`.
- Dep : `@aws-sdk/client-s3`.

## Sous-routes fichier (port fidèle, câblées dans les modules existants)

| Module | Routes | Bucket-préfixe |
|---|---|---|
| auth (avatar) | `POST /auth/me/avatar` (multipart image, auth+CSRF) · `GET /auth/avatar/:userId` (**public**, stream) | `avatars/` |
| prescriptions | `GET/POST/DELETE /:id/document` (auth ; POST/DELETE CSRF) | `prescriptions/` |
| documents | `GET/POST/DELETE /:id/file` | `documents/` |
| recurring-entries | `GET/POST/DELETE /:id/payslip` | `payslips/` |
| salary-archives | `GET/POST/DELETE /:id/payslip` | `payslips/` |

- **Ownership** : pour les routes scopées, vérifier que le record (`prescription`/`document`/
  `recurringEntry`/`salaryArchive`) appartient au `userId` AVANT tout accès R2 (404 sinon).
- **Upload** : lit le buffer multipart → `storage.upload(key, buffer, ct)` → met à jour la
  colonne (`avatarUrl`/`documentUrl`/`fileUrl`/`payslipKey`) avec la clé. 201/200.
- **GET** : récupère la clé en DB (ownership), `getStream` → pipe `Content-Type` + body ;
  404 si absent. (avatar GET public : lit par `userId`.)
- **DELETE** : `storage.delete(key)` + clear la colonne. 204.
- Les routes GET fichier sont scopées au propriétaire (sauf avatar public).

## Tests & critères de succès

**Tests** :
- Unit `StorageService` : `upload`/`getStream`/`delete` émettent `PutObject`/`GetObject`/
  `DeleteObject` avec bucket+key attendus (S3Client mocké via `vi.mock`/injection d'un
  client fake) ; key builders (préfixe + extension, jpeg→jpg) ; "non configuré" → erreur.
- Unit routes fichier : ownership (record d'un autre user → 404 avant accès R2, storage
  non appelé) ; DELETE clear la colonne.
- **Live R2 (manuel, nécessite creds)** : `POST /auth/me/avatar` → `GET /auth/avatar/:id`
  récupère → `DELETE` → 404. Couvert sinon par les units (S3 mocké).

**Critères** :
1. `StorageService` câblé R2 (bucket unique + préfixes) ; upload/get/delete (mocké CI, réel avec creds).
2. Les 5 groupes de sous-routes répondent (parité Hono), ownership respectée.
3. App boote sans creds R2 ; routes upload → 503 propre.
4. Streaming privé via backend ; avatar GET public.
5. Tests verts ; aucune régression B1-B5.

## Hors-périmètre

- Presigned URLs, scan antivirus, redimensionnement image, CDN/custom domain R2.
- **B-final** (bascule front + décommission Hono) — étape suivante.
