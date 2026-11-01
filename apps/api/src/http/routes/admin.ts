import { Hono } from 'hono';
import { parseBody } from '../../common/parse-body';
import {
  deleteUsersSchema,
  listQuerySchema,
  sendNoticesSchema,
} from '../../modules/admin/dto/admin.dto';
import type { HttpDeps } from '../deps';
import { csrfOnMutations, requireAuth, requireRole } from '../middleware/auth';
import { STRICT_THROTTLE, throttle } from '../middleware/rate-limit';
import type { AppEnv } from '../types';
import { jsonBody } from '../validate';

/**
 * Routes /admin (contrôleur Nest AdminController). Pas `authedRouter` : sous Nest, les gardes de
 * classe (JWT puis rôle) passent avant le CsrfGuard de méthode ; un non-admin reçoit donc le
 * refus de rôle, pas celui du CSRF. Même ordre ici.
 */
export function adminRoutes(d: HttpDeps): Hono<AppEnv> {
  const strict = throttle(STRICT_THROTTLE);
  return (
    new Hono<AppEnv>()
      .use(
        requireAuth(d.sessions),
        requireRole(d.roles, 'admin'),
        csrfOnMutations(d.csrfPolicy),
      )
      .get('/users', async (c) => {
        const { search, page, pageSize } = parseBody(
          listQuerySchema,
          c.req.query(),
        );
        return c.json(
          await d.admin.listUsers({
            search,
            limit: pageSize,
            offset: (page - 1) * pageSize,
          }),
        );
      })

      /** Par motif de relance : comptes concernés et comptes encore dans le délai de 7 jours. */
      .get('/notices/summary', async (c) =>
        c.json(await d.admin.noticeSummary()),
      )

      /** Envoi groupé (sans `userIds`) ou sélectif (avec). Les textes sont fixes, choisis par `reason`. */
      .post('/notices', strict, async (c) => {
        const { reason, userIds } = await jsonBody(c, sendNoticesSchema);
        return c.json(
          await d.admin.sendNotices(reason, userIds, c.get('user').id),
          200,
        );
      })

      /**
       * Supprime des faux comptes. Le serveur n'efface que des comptes dont l'e-mail n'a jamais été
       * vérifié ; tout autre compte demandé revient dans `skipped` avec la raison du refus.
       */
      .post('/users/delete-unverified', strict, async (c) => {
        const { userIds } = await jsonBody(c, deleteUsersSchema);
        return c.json(
          await d.admin.deleteUnverifiedUsers(userIds, c.get('user').id),
          200,
        );
      })
  );
}
