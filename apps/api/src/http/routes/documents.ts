import type { Hono } from 'hono';
import { Readable } from 'node:stream';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';
import { assertOwnedStorageKey } from '../../common/files/storage-key';
import { UPLOAD_MULTER_LIMIT_BYTES } from '../../common/files/validate-upload';
import { parseBody } from '../../common/parse-body';
import {
  createDocumentSchema,
  createEncryptedDocumentSchema,
  updateDocumentSchema,
  updateEncryptedDocumentSchema,
} from '../../modules/documents/dto/document.dto';
import type { HttpDeps } from '../deps';
import { uploadLimit, uploadedFile, uuidParam } from '../kit';
import { rejectDemo } from '../middleware/auth';
import type { AppEnv } from '../types';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /documents (contrôleur Nest DocumentsController). */
export function documentsRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.documents,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, patientId, practitionerId } = parseBody(
            createEncryptedDocumentSchema,
            body,
          );
          return {
            patientId,
            practitionerId: practitionerId ?? null,
            type: 'autre',
            title: '',
            date: '1970-01-01',
            encryptedData,
          };
        }
        const d = parseBody(createDocumentSchema, body);
        return {
          patientId: d.patientId,
          practitionerId: d.practitionerId ?? null,
          type: d.type,
          title: d.title,
          date: d.date,
          notes: d.notes ?? null,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const d = parseBody(updateEncryptedDocumentSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: d.encryptedData,
          };
          if (d.patientId !== undefined) patch.patientId = d.patientId;
          if (d.practitionerId !== undefined)
            patch.practitionerId = d.practitionerId ?? null;
          return patch;
        }
        const d = parseBody(updateDocumentSchema, body);
        const patch: Record<string, unknown> = {};
        if (d.patientId !== undefined) patch.patientId = d.patientId;
        if (d.practitionerId !== undefined)
          patch.practitionerId = d.practitionerId ?? null;
        if (d.type !== undefined) patch.type = d.type;
        if (d.title !== undefined) patch.title = d.title;
        if (d.date !== undefined) patch.date = d.date;
        if (d.notes !== undefined) patch.notes = d.notes ?? null;
        return patch;
      },
    },
    (r) =>
      r
        // Route statique avant /:id, sinon « by-patient » serait pris pour un id.
        .get('/by-patient/:patientId', async (c) =>
          c.json(
            await d.documents.byPatient(
              c.get('user').id,
              uuidParam(c, 'patientId'),
            ),
          ),
        )

        // --- Fichier joint au document ---
        .post(
          '/:id/file',
          rejectDemo(),
          uploadLimit(UPLOAD_MULTER_LIMIT_BYTES),
          async (c) => {
            const userId = c.get('user').id;
            // Sous Nest, multer (intercepteur) lit le fichier AVANT ParseUUIDPipe : même ordre.
            const { file } = await uploadedFile(
              c,
              'file',
              UPLOAD_MULTER_LIMIT_BYTES,
            );
            const id = uuidParam(c, 'id');
            if (!file) throw new BadRequestError('Fichier requis');
            await d.uploadPolicy.assertValid(userId, file);
            const existing = await d.documents.getOne(userId, id);
            if (!existing) throw new NotFoundError('Non trouvé');
            const key = d.storage.documentKey(userId, id, file.mimetype);
            await d.storage.upload(key, file.buffer, file.mimetype);
            // Remplacement avec un autre MIME → autre extension → autre clé : l'ancien objet partirait orphelin.
            if (existing.fileUrl && existing.fileUrl !== key) {
              await deleteStorageObjectQuietly(d.storage, existing.fileUrl);
            }
            const row = await d.documents.update(userId, id, { fileUrl: key });
            // Nest répondait 201 sans corps si la ligne avait disparu entre-temps.
            return row === undefined ? c.body(null, 201) : c.json(row, 201);
          },
        )

        .get('/:id/file', async (c) => {
          const userId = c.get('user').id;
          const doc = await d.documents.getOne(userId, uuidParam(c, 'id'));
          if (!doc?.fileUrl) throw new NotFoundError('Fichier introuvable');
          const obj = await d.storage.getStream(
            assertOwnedStorageKey(userId, doc.fileUrl, 'documents'),
          );
          if (!obj) throw new NotFoundError('Fichier introuvable');
          return c.body(Readable.toWeb(obj.stream) as ReadableStream, 200, {
            'Content-Type': obj.contentType,
            'Content-Disposition': 'attachment',
          });
        })

        .delete('/:id/file', async (c) => {
          const userId = c.get('user').id;
          const id = uuidParam(c, 'id');
          const doc = await d.documents.getOne(userId, id);
          if (!doc) throw new NotFoundError('Non trouvé');
          if (doc.fileUrl)
            await d.storage.delete(
              assertOwnedStorageKey(userId, doc.fileUrl, 'documents'),
            );
          await d.documents.update(userId, id, { fileUrl: null });
          return c.body(null, 204);
        }),
  );
}
