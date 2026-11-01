import type { Hono } from 'hono';
import { parseBody } from '../../common/parse-body';
import {
  createEncryptedPractitionerSchema,
  createPractitionerSchema,
  updateEncryptedPractitionerSchema,
  updatePractitionerSchema,
} from '../../modules/practitioners/dto/practitioner.dto';
import type { HttpDeps } from '../deps';
import type { AppEnv } from '../types';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /practitioners (contrôleur Nest PractitionersController). */
export function practitionersRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(d, d.practitioners, {
    toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
      if (body.encryptedData) {
        const { encryptedData } = parseBody(
          createEncryptedPractitionerSchema,
          body,
        );
        return { name: '', type: 'autre', encryptedData };
      }
      const d = parseBody(createPractitionerSchema, body);
      return {
        name: d.name,
        type: d.type,
        phone: d.phone ?? null,
        email: d.email ?? null,
        address: d.address ?? null,
        bookingUrl: d.bookingUrl ?? null,
      };
    },
    toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
      if (body.encryptedData) {
        const { encryptedData } = parseBody(
          updateEncryptedPractitionerSchema,
          body,
        );
        return { encryptedData };
      }
      const d = parseBody(updatePractitionerSchema, body);
      const patch: Record<string, unknown> = {};
      if (d.name !== undefined) patch.name = d.name;
      if (d.type !== undefined) patch.type = d.type;
      if (d.phone !== undefined) patch.phone = d.phone;
      if (d.email !== undefined) patch.email = d.email;
      if (d.address !== undefined) patch.address = d.address;
      if (d.bookingUrl !== undefined) patch.bookingUrl = d.bookingUrl;
      return patch;
    },
  });
}
