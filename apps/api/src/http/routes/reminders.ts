import type { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { parseBody } from '../../common/parse-body';
import {
  createReminderSchema,
  updateReminderSchema,
} from '../../modules/reminders/dto/reminder.dto';
import type { HttpDeps } from '../deps';
import { uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /reminders (contrôleur Nest RemindersController). */
export function remindersRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.reminders,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        const d = parseBody(createReminderSchema, body);
        return {
          target: d.target,
          medicationId: d.medicationId ?? null,
          appointmentId: d.appointmentId ?? null,
          enabled: d.enabled ?? true,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        const d = parseBody(updateReminderSchema, body);
        const patch: Record<string, unknown> = {};
        if (d.target !== undefined) patch.target = d.target;
        if (d.medicationId !== undefined) patch.medicationId = d.medicationId;
        if (d.appointmentId !== undefined)
          patch.appointmentId = d.appointmentId;
        if (d.enabled !== undefined) patch.enabled = d.enabled;
        return patch;
      },
    },
    (r) =>
      r.patch('/:id/toggle', async (c) => {
        const row = await d.reminders.toggle(
          c.get('user').id,
          uuidParam(c, 'id'),
        );
        if (row === undefined) throw new NotFoundError('Non trouvé');
        return c.json(row);
      }),
  );
}
