import type { Hono } from 'hono';
import { AppError, NotFoundError } from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import { parsePageQuery } from '../../common/crud/keyset';
import { parseBody } from '../../common/parse-body';
import {
  createMemberSchema,
  encryptedMemberSchema,
  updateMemberSchema,
} from '../../modules/members/dto/member.dto';
import type { HttpDeps } from '../deps';
import { sendPage, uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { authedRouter } from './owned-crud';

const MEMBER_HAS_MEDICAL_DATA = 'MEMBER_HAS_MEDICAL_DATA';

/**
 * Routes /members (contrôleur Nest MembersController). Pas d'OwnedCrudController : ni GET /:id,
 * et un DELETE qui protège le dossier médical.
 */
export function membersRoutes(d: HttpDeps): Hono<AppEnv> {
  return (
    authedRouter(d)
      .get('/', async (c) => {
        const page = await d.members.list(
          c.get('user').id,
          parsePageQuery(c.req.query()),
        );
        return c.json(sendPage(c, page));
      })
      .post('/', async (c) => {
        const userId = c.get('user').id;
        const body = await jsonObject(c);
        if (body.encryptedData) {
          const { encryptedData } = parseBody(encryptedMemberSchema, body);
          return c.json(
            await d.members.create(userId, {
              encryptedData,
              ...clientRowId(body),
            }),
            201,
          );
        }
        // Chemin en clair : pas d'id fixé par le client (seul l'E2EE en a besoin).
        const v = parseBody(createMemberSchema, body);
        return c.json(
          await d.members.create(userId, {
            firstName: v.firstName,
            lastName: v.lastName ?? '',
            color: v.color ?? null,
          }),
          201,
        );
      })
      .put('/:id', async (c) => {
        const id = uuidParam(c, 'id');
        const body = await jsonObject(c);
        let patch: Record<string, unknown>;
        if (body.encryptedData) {
          const { encryptedData } = parseBody(encryptedMemberSchema, body);
          patch = { encryptedData };
        } else {
          const v = parseBody(updateMemberSchema, body);
          patch = {
            firstName: v.firstName,
            lastName: v.lastName ?? '',
            color: v.color ?? null,
          };
        }
        const row = await d.members.update(c.get('user').id, id, patch);
        if (!row) throw new NotFoundError('Non trouvé');
        return c.json(row);
      })
      /**
       * Un membre est aussi un patient : le supprimer efface (cascade) ses RDV, ordonnances,
       * médicaments et documents. Sans `?force=true`, on refuse (409) en renvoyant les compteurs
       * pour que le front énumère ce qui va disparaître avant de redemander avec `force`.
       */
      .delete('/:id', async (c) => {
        const userId = c.get('user').id;
        const id = uuidParam(c, 'id');
        const footprint = await d.members.medicalFootprint(userId, id);
        // Idempotent : déjà supprimé ou inconnu → 204.
        if (!footprint) return c.body(null, 204);
        const total = Object.values(footprint).reduce((s, n) => s + n, 0);
        if (total > 0 && c.req.query('force') !== 'true') {
          throw new AppError(
            409,
            'Ce membre a un dossier médical qui serait supprimé avec lui',
            MEMBER_HAS_MEDICAL_DATA,
            footprint,
          );
        }
        await d.members.remove(userId, id);
        return c.body(null, 204);
      })
  );
}
