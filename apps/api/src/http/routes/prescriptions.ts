import type { Hono } from 'hono';
import { Readable } from 'node:stream';
import { BadRequestError, NotFoundError } from '../../common/errors';
import { deleteStorageObjectQuietly } from '../../common/files/storage-cleanup';
import { assertOwnedStorageKey } from '../../common/files/storage-key';
import { UPLOAD_MULTER_LIMIT_BYTES } from '../../common/files/validate-upload';
import { parseBody } from '../../common/parse-body';
import {
  createEncryptedPrescriptionSchema,
  createPrescriptionSchema,
  updateEncryptedPrescriptionSchema,
  updatePrescriptionSchema,
} from '../../modules/prescriptions/dto/prescription.dto';
import type { HttpDeps } from '../deps';
import { uploadLimit, uploadedFile, uuidParam } from '../kit';
import { rejectDemo } from '../middleware/auth';
import type { AppEnv } from '../types';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /prescriptions (contrôleur Nest PrescriptionsController). */
export function prescriptionsRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.prescriptions,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, appointmentId, practitionerId, patientId } =
            parseBody(createEncryptedPrescriptionSchema, body);
          return {
            appointmentId: appointmentId ?? null,
            practitionerId: practitionerId ?? null,
            patientId,
            issuedDate: '1970-01-01',
            encryptedData,
          };
        }
        const d = parseBody(createPrescriptionSchema, body);
        return {
          appointmentId: d.appointmentId ?? null,
          practitionerId: d.practitionerId ?? null,
          patientId: d.patientId,
          issuedDate: d.issuedDate,
          validUntil: d.validUntil ?? null,
          notes: d.notes ?? null,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const d = parseBody(updateEncryptedPrescriptionSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: d.encryptedData,
          };
          if (d.appointmentId !== undefined)
            patch.appointmentId = d.appointmentId ?? null;
          if (d.practitionerId !== undefined)
            patch.practitionerId = d.practitionerId ?? null;
          if (d.patientId !== undefined) patch.patientId = d.patientId;
          return patch;
        }
        const d = parseBody(updatePrescriptionSchema, body);
        const patch: Record<string, unknown> = {};
        if (d.appointmentId !== undefined)
          patch.appointmentId = d.appointmentId ?? null;
        if (d.practitionerId !== undefined)
          patch.practitionerId = d.practitionerId ?? null;
        if (d.patientId !== undefined) patch.patientId = d.patientId;
        if (d.issuedDate !== undefined) patch.issuedDate = d.issuedDate;
        if (d.validUntil !== undefined) patch.validUntil = d.validUntil;
        if (d.notes !== undefined) patch.notes = d.notes;
        return patch;
      },
    },
    (r) =>
      r
        // Route statique avant /:id, sinon « by-appointment » serait pris pour un id.
        .get('/by-appointment/:appointmentId', async (c) =>
          c.json(
            await d.prescriptions.byAppointment(
              c.get('user').id,
              uuidParam(c, 'appointmentId'),
            ),
          ),
        )

        // --- Fichier joint à l'ordonnance ---
        .post(
          '/:id/document',
          rejectDemo(),
          uploadLimit(UPLOAD_MULTER_LIMIT_BYTES),
          async (c) => {
            const userId = c.get('user').id;
            // Sous Nest, multer (intercepteur) lit le fichier AVANT ParseUUIDPipe : même ordre.
            const { file } = await uploadedFile(
              c,
              'document',
              UPLOAD_MULTER_LIMIT_BYTES,
            );
            const id = uuidParam(c, 'id');
            if (!file) throw new BadRequestError('Fichier requis');
            await d.uploadPolicy.assertValid(userId, file);
            const existing = await d.prescriptions.getOne(userId, id);
            if (!existing) throw new NotFoundError('Non trouvé');
            const key = d.storage.prescriptionKey(userId, id, file.mimetype);
            await d.storage.upload(key, file.buffer, file.mimetype);
            // Remplacement avec un autre MIME → autre extension → autre clé : l'ancien objet partirait orphelin.
            if (existing.documentUrl && existing.documentUrl !== key) {
              await deleteStorageObjectQuietly(d.storage, existing.documentUrl);
            }
            const row = await d.prescriptions.update(userId, id, {
              documentUrl: key,
            });
            // Nest répondait 201 sans corps si la ligne avait disparu entre-temps.
            return row === undefined ? c.body(null, 201) : c.json(row, 201);
          },
        )

        .get('/:id/document', async (c) => {
          const userId = c.get('user').id;
          const presc = await d.prescriptions.getOne(
            userId,
            uuidParam(c, 'id'),
          );
          if (!presc?.documentUrl)
            throw new NotFoundError('Document introuvable');
          const obj = await d.storage.getStream(
            assertOwnedStorageKey(userId, presc.documentUrl, 'prescriptions'),
          );
          if (!obj) throw new NotFoundError('Document introuvable');
          return c.body(Readable.toWeb(obj.stream) as ReadableStream, 200, {
            'Content-Type': obj.contentType,
            'Content-Disposition': 'attachment',
          });
        })

        .delete('/:id/document', async (c) => {
          const userId = c.get('user').id;
          const id = uuidParam(c, 'id');
          const presc = await d.prescriptions.getOne(userId, id);
          if (!presc) throw new NotFoundError('Non trouvé');
          if (presc.documentUrl)
            await d.storage.delete(
              assertOwnedStorageKey(userId, presc.documentUrl, 'prescriptions'),
            );
          await d.prescriptions.update(userId, id, { documentUrl: null });
          return c.body(null, 204);
        }),
  );
}
