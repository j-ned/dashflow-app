import type { Hono } from 'hono';
import { Readable } from 'node:stream';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';
import { assertOwnedStorageKey } from '../../common/files/storage-key';
import { UPLOAD_MULTER_LIMIT_BYTES } from '../../common/files/validate-upload';
import { parseBody } from '../../common/parse-body';
import {
  createEncryptedSalaryArchiveSchema,
  createSalaryArchiveSchema,
  updateEncryptedSalaryArchiveSchema,
  updateSalaryArchiveSchema,
} from '../../modules/salary-archives/dto/salary-archive.dto';
import type { HttpDeps } from '../deps';
import { uploadLimit, uploadedFile, uuidParam } from '../kit';
import { rejectDemo } from '../middleware/auth';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { ownedCrudRoutes } from './owned-crud';

// E2EE : en mode chiffré, month/salary sont des placeholders (le vrai contenu
// est dans encryptedData, opaque au serveur). Le payslip s'upload via POST :id/payslip.
function toCreateValues(
  body: Record<string, unknown>,
): Record<string, unknown> {
  if (body.encryptedData) {
    const { encryptedData, accountId } = parseBody(
      createEncryptedSalaryArchiveSchema,
      body,
    );
    return {
      ...clientRowId(body),
      accountId: accountId ?? null,
      month: '0000-00',
      salary: '0',
      encryptedData,
    };
  }
  const v = parseBody(createSalaryArchiveSchema, body);
  return {
    accountId: v.accountId ?? null,
    month: v.month,
    salary: v.salary,
    totalExpenses: v.totalExpenses ?? '0',
    totalSpendings: v.totalSpendings ?? '0',
    spendings: v.spendings ?? [],
  };
}

/**
 * Routes /salary-archives (contrôleur Nest SalaryArchivesController). POST / et DELETE /:id
 * surchargent le CRUD générique : déclarés dans `extra`, ils passent avant et le masquent.
 */
export function salaryArchivesRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.salaryArchives,
    {
      toCreateValues,
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const v = parseBody(updateEncryptedSalaryArchiveSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: v.encryptedData,
          };
          if (v.accountId !== undefined) patch.accountId = v.accountId;
          return patch;
        }
        const v = parseBody(updateSalaryArchiveSchema, body);
        const patch: Record<string, unknown> = {};
        if (v.month !== undefined) patch.month = v.month;
        if (v.salary !== undefined) patch.salary = v.salary;
        if (v.totalExpenses !== undefined)
          patch.totalExpenses = v.totalExpenses;
        if (v.totalSpendings !== undefined)
          patch.totalSpendings = v.totalSpendings;
        if (v.spendings !== undefined) patch.spendings = v.spendings;
        if (v.accountId !== undefined) patch.accountId = v.accountId;
        return patch;
      },
    },
    (r) =>
      r
        // Création en JSON ou en multipart (fiche de paie jointe, champs texte = corps).
        .post('/', uploadLimit(UPLOAD_MULTER_LIMIT_BYTES), async (c) => {
          const u = c.get('user');
          const multipart = c.req
            .header('content-type')
            ?.startsWith('multipart/form-data');
          const { file, fields } = await uploadedFile(
            c,
            'payslip',
            UPLOAD_MULTER_LIMIT_BYTES,
          );
          const body = multipart ? fields : await jsonObject(c);
          const values = toCreateValues(body);
          // Tout ce qui peut refuser la requête AVANT d'écrire : sous Nest, la ligne était créée
          // puis le fichier refusé (démo, magic-bytes) — archive orpheline, doublon au nouvel essai.
          if (file) {
            if (u.isDemo)
              throw new ForbiddenError(
                'Action indisponible sur le compte démo',
              );
            await d.uploadPolicy.assertValid(u.id, file);
          }
          const row = await d.salaryArchives.create(u.id, values);
          if (!file) return c.json(row, 201);
          const key = d.storage.payslipKey(u.id, row.id, file.mimetype);
          await d.storage.upload(key, file.buffer, file.mimetype);
          const updated = await d.salaryArchives.update(u.id, row.id, {
            payslipKey: key,
          });
          return updated === undefined
            ? c.body(null, 201)
            : c.json(updated, 201);
        })
        .delete('/:id', async (c) => {
          const userId = c.get('user').id;
          const id = uuidParam(c, 'id');
          const row = await d.salaryArchives.getOne(userId, id);
          // Message propre à ce contrôleur (« Not found », pas « Non trouvé »).
          if (!row) throw new NotFoundError('Not found');
          await d.salaryArchives.remove(userId, id);
          return c.body(null, 204);
        })

        // --- Sous-routes du fichier de fiche de paie ---
        .post(
          '/:id/payslip',
          rejectDemo(),
          uploadLimit(UPLOAD_MULTER_LIMIT_BYTES),
          async (c) => {
            const userId = c.get('user').id;
            // Sous Nest, multer (intercepteur) lit le fichier AVANT ParseUUIDPipe : même ordre ici.
            const { file } = await uploadedFile(
              c,
              'payslip',
              UPLOAD_MULTER_LIMIT_BYTES,
            );
            const id = uuidParam(c, 'id');
            if (!file) throw new BadRequestError('Fichier requis');
            await d.uploadPolicy.assertValid(userId, file);
            const existing = await d.salaryArchives.getOne(userId, id);
            if (!existing) throw new NotFoundError('Non trouvé');
            const key = d.storage.payslipKey(userId, id, file.mimetype);
            await d.storage.upload(key, file.buffer, file.mimetype);
            // Remplacement avec un autre MIME → autre extension → autre clé : l'ancien objet partirait orphelin.
            if (existing.payslipKey && existing.payslipKey !== key) {
              await deleteStorageObjectQuietly(d.storage, existing.payslipKey);
            }
            const row = await d.salaryArchives.update(userId, id, {
              payslipKey: key,
            });
            // Nest renvoie un corps vide si la ligne a disparu entre-temps.
            return row === undefined ? c.body(null, 201) : c.json(row, 201);
          },
        )
        .get('/:id/payslip', async (c) => {
          const userId = c.get('user').id;
          const row = await d.salaryArchives.getOne(userId, uuidParam(c, 'id'));
          if (!row?.payslipKey)
            throw new NotFoundError('Fiche de paie introuvable');
          const obj = await d.storage.getStream(
            assertOwnedStorageKey(userId, row.payslipKey, 'payslips'),
          );
          if (!obj) throw new NotFoundError('Fiche de paie introuvable');
          return c.body(Readable.toWeb(obj.stream) as ReadableStream, 200, {
            'Content-Type': obj.contentType,
            'Content-Disposition': 'attachment',
          });
        })
        .delete('/:id/payslip', async (c) => {
          const userId = c.get('user').id;
          const id = uuidParam(c, 'id');
          const row = await d.salaryArchives.getOne(userId, id);
          if (!row) throw new NotFoundError('Non trouvé');
          if (row.payslipKey)
            await d.storage.delete(
              assertOwnedStorageKey(userId, row.payslipKey, 'payslips'),
            );
          await d.salaryArchives.update(userId, id, { payslipKey: null });
          return c.body(null, 204);
        }),
  );
}
