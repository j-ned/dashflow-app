import type { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { parseBody } from '../../common/parse-body';
import {
  createEncryptedMedicationSchema,
  createMedicationSchema,
  refillMedicationSchema,
  updateEncryptedMedicationSchema,
  updateMedicationSchema,
} from '../../modules/medications/dto/medication.dto';
import type { HttpDeps } from '../deps';
import { uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /medications (contrôleur Nest MedicationsController). */
export function medicationsRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.medications,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, patientId, prescriptionId } = parseBody(
            createEncryptedMedicationSchema,
            body,
          );
          return {
            prescriptionId: prescriptionId ?? null,
            patientId,
            name: '',
            type: 'comprime',
            dosage: '',
            startDate: '1970-01-01',
            encryptedData,
          };
        }
        const d = parseBody(createMedicationSchema, body);
        return {
          prescriptionId: d.prescriptionId ?? null,
          patientId: d.patientId,
          name: d.name,
          type: d.type,
          dosage: d.dosage,
          quantity: d.quantity ?? 0,
          dailyRate: d.dailyRate ?? '1',
          startDate: d.startDate,
          alertDaysBefore: d.alertDaysBefore ?? 7,
          skipDays: d.skipDays ?? [],
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const d = parseBody(updateEncryptedMedicationSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: d.encryptedData,
          };
          if (d.prescriptionId !== undefined)
            patch.prescriptionId = d.prescriptionId ?? null;
          if (d.patientId !== undefined) patch.patientId = d.patientId;
          return patch;
        }
        const d = parseBody(updateMedicationSchema, body);
        const patch: Record<string, unknown> = {};
        if (d.prescriptionId !== undefined)
          patch.prescriptionId = d.prescriptionId ?? null;
        if (d.patientId !== undefined) patch.patientId = d.patientId;
        if (d.name !== undefined) patch.name = d.name;
        if (d.type !== undefined) patch.type = d.type;
        if (d.dosage !== undefined) patch.dosage = d.dosage;
        if (d.quantity !== undefined) patch.quantity = d.quantity;
        if (d.dailyRate !== undefined) patch.dailyRate = d.dailyRate;
        if (d.startDate !== undefined) patch.startDate = d.startDate;
        if (d.alertDaysBefore !== undefined)
          patch.alertDaysBefore = d.alertDaysBefore;
        if (d.skipDays !== undefined) patch.skipDays = d.skipDays;
        return patch;
      },
    },
    (r) =>
      r
        // Route statique avant /:id, sinon « alerts » serait pris pour un id.
        .get('/alerts', async (c) =>
          c.json(await d.medications.alerts(c.get('user').id)),
        )
        .patch('/:id/refill', async (c) => {
          const id = uuidParam(c, 'id');
          const { quantity } = parseBody(
            refillMedicationSchema,
            await jsonObject(c),
          );
          const row = await d.medications.refill(
            c.get('user').id,
            id,
            quantity,
          );
          if (!row) throw new NotFoundError('Non trouvé');
          return c.json(row);
        }),
  );
}
