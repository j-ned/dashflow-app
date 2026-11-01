import type { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { parseBody } from '../../common/parse-body';
import {
  createAppointmentSchema,
  createEncryptedAppointmentSchema,
  updateAppointmentSchema,
  updateAppointmentStatusSchema,
  updateEncryptedAppointmentSchema,
} from '../../modules/appointments/dto/appointment.dto';
import type { HttpDeps } from '../deps';
import { uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /appointments (contrôleur Nest AppointmentsController). */
export function appointmentsRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.appointments,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, patientId, practitionerId } = parseBody(
            createEncryptedAppointmentSchema,
            body,
          );
          return {
            patientId,
            practitionerId,
            date: '1970-01-01',
            time: '00:00',
            encryptedData,
          };
        }
        const d = parseBody(createAppointmentSchema, body);
        return {
          patientId: d.patientId,
          practitionerId: d.practitionerId,
          date: d.date,
          time: d.time,
          status: d.status ?? 'scheduled',
          reason: d.reason ?? null,
          outcome: d.outcome ?? null,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const d = parseBody(updateEncryptedAppointmentSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: d.encryptedData,
          };
          if (d.patientId !== undefined) patch.patientId = d.patientId;
          if (d.practitionerId !== undefined)
            patch.practitionerId = d.practitionerId;
          return patch;
        }
        const d = parseBody(updateAppointmentSchema, body);
        const patch: Record<string, unknown> = {};
        if (d.patientId !== undefined) patch.patientId = d.patientId;
        if (d.practitionerId !== undefined)
          patch.practitionerId = d.practitionerId;
        if (d.date !== undefined) patch.date = d.date;
        if (d.time !== undefined) patch.time = d.time;
        if (d.status !== undefined) patch.status = d.status;
        if (d.reason !== undefined) patch.reason = d.reason;
        if (d.outcome !== undefined) patch.outcome = d.outcome;
        return patch;
      },
    },
    (r) =>
      r.patch('/:id/status', async (c) => {
        const id = uuidParam(c, 'id');
        const { status } = parseBody(
          updateAppointmentStatusSchema,
          await jsonObject(c),
        );
        const row = await d.appointments.setStatus(
          c.get('user').id,
          id,
          status,
        );
        if (!row) throw new NotFoundError('Non trouvé');
        return c.json(row);
      }),
  );
}
