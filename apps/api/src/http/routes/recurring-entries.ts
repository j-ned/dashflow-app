import type { Hono } from 'hono';
import { Readable } from 'node:stream';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';
import { assertOwnedStorageKey } from '../../common/files/storage-key';
import { UPLOAD_MULTER_LIMIT_BYTES } from '../../common/files/validate-upload';
import { parseBody } from '../../common/parse-body';
import {
  createEncryptedRecurringEntrySchema,
  createRecurringEntrySchema,
  updateEncryptedRecurringEntrySchema,
  updateRecurringEntrySchema,
} from '../../modules/recurring-entries/dto/recurring-entry.dto';
import type { HttpDeps } from '../deps';
import { uploadLimit, uploadedFile, uuidParam } from '../kit';
import { rejectDemo } from '../middleware/auth';
import type { AppEnv } from '../types';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /recurring-entries (contrôleur Nest RecurringEntriesController). */
export function recurringEntriesRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.recurringEntries,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, memberId, accountId, toAccountId } = parseBody(
            createEncryptedRecurringEntrySchema,
            body,
          );
          return {
            memberId: memberId ?? null,
            accountId: accountId ?? null,
            // toAccountId reste en clair (référence FK) : sans lui, un virement chiffré ne crédite
            // jamais le compte destination (le solde le filtre par to_account_id).
            toAccountId: toAccountId ?? null,
            label: '',
            amount: '0',
            type: 'income',
            encryptedData,
          };
        }
        const v = parseBody(createRecurringEntrySchema, body);
        return {
          memberId: v.memberId ?? null,
          accountId: v.accountId ?? null,
          toAccountId: v.toAccountId ?? null,
          label: v.label,
          amount: v.amount,
          type: v.type,
          dayOfMonth: v.dayOfMonth ?? null,
          date: v.date ?? null,
          endDate: v.endDate ?? null,
          category: v.category ?? null,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const v = parseBody(updateEncryptedRecurringEntrySchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: v.encryptedData,
          };
          if (v.memberId !== undefined) patch.memberId = v.memberId;
          if (v.accountId !== undefined) patch.accountId = v.accountId;
          if (v.toAccountId !== undefined) patch.toAccountId = v.toAccountId;
          return patch;
        }
        const v = parseBody(updateRecurringEntrySchema, body);
        const patch: Record<string, unknown> = {};
        if (v.memberId !== undefined) patch.memberId = v.memberId;
        if (v.accountId !== undefined) patch.accountId = v.accountId;
        if (v.toAccountId !== undefined) patch.toAccountId = v.toAccountId;
        if (v.label !== undefined) patch.label = v.label;
        if (v.amount !== undefined) patch.amount = v.amount;
        if (v.type !== undefined) patch.type = v.type;
        if (v.dayOfMonth !== undefined) patch.dayOfMonth = v.dayOfMonth;
        if (v.date !== undefined) patch.date = v.date;
        if (v.endDate !== undefined) patch.endDate = v.endDate;
        if (v.category !== undefined) patch.category = v.category;
        return patch;
      },
    },
    // --- Sous-routes du fichier de fiche de paie ---
    (r) =>
      r
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
            const existing = await d.recurringEntries.getOne(userId, id);
            if (!existing) throw new NotFoundError('Non trouvé');
            const key = d.storage.payslipKey(userId, id, file.mimetype);
            await d.storage.upload(key, file.buffer, file.mimetype);
            // Remplacement avec un autre MIME → autre extension → autre clé : l'ancien objet partirait orphelin.
            if (existing.payslipKey && existing.payslipKey !== key) {
              await deleteStorageObjectQuietly(d.storage, existing.payslipKey);
            }
            const row = await d.recurringEntries.update(userId, id, {
              payslipKey: key,
            });
            // Nest renvoie un corps vide si la ligne a disparu entre-temps.
            return row === undefined ? c.body(null, 201) : c.json(row, 201);
          },
        )
        .get('/:id/payslip', async (c) => {
          const userId = c.get('user').id;
          const row = await d.recurringEntries.getOne(
            userId,
            uuidParam(c, 'id'),
          );
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
          const row = await d.recurringEntries.getOne(userId, id);
          if (!row) throw new NotFoundError('Non trouvé');
          if (row.payslipKey)
            await d.storage.delete(
              assertOwnedStorageKey(userId, row.payslipKey, 'payslips'),
            );
          await d.recurringEntries.update(userId, id, { payslipKey: null });
          return c.body(null, 204);
        }),
  );
}
