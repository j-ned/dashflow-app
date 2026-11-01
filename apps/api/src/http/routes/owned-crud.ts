import { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import {
  parsePageQuery,
  type Page,
  type PageQuery,
} from '../../common/crud/keyset';
import type { HttpDeps } from '../deps';
import { sendPage, uuidParam } from '../kit';
import { csrfOnMutations, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';

export interface CrudService<T> {
  list(userId: string, q?: PageQuery): Promise<Page<T>>;
  getOne(userId: string, id: string): Promise<T | undefined>;
  create(userId: string, values: Record<string, unknown>): Promise<T>;
  update(
    userId: string,
    id: string,
    patch: Record<string, unknown>,
  ): Promise<T | undefined>;
  remove(userId: string, id: string): Promise<void>;
}

export type CrudMapping<T> = {
  /** Corps de création validé → valeurs insérées (chemin chiffré E2EE ou en clair). */
  toCreateValues(body: Record<string, unknown>): Record<string, unknown>;
  /** Corps de mise à jour validé → colonnes modifiées. */
  toUpdatePatch(body: Record<string, unknown>): Record<string, unknown>;
  /** DTO de sortie (défaut : la ligne telle quelle). */
  toResponse?: (row: T) => unknown;
};

/** Groupe authentifié : session + CSRF sur toute mutation, sûr par défaut. */
export function authedRouter(d: HttpDeps): Hono<AppEnv> {
  return new Hono<AppEnv>().use(
    requireAuth(d.sessions),
    csrfOnMutations(d.csrfPolicy),
  );
}

/**
 * CRUD d'une ressource possédée par l'utilisateur (équivalent de OwnedCrudController) :
 * GET / (paginé), GET /:id, POST / (201), PUT /:id, DELETE /:id (204). Les routes propres au
 * module se déclarent dans `extra`, AVANT celles-ci (chemins statiques prioritaires sur /:id).
 */
export function ownedCrudRoutes<T>(
  d: HttpDeps,
  svc: CrudService<T>,
  mapping: CrudMapping<T>,
  extra: (router: Hono<AppEnv>) => Hono<AppEnv> = (r) => r,
): Hono<AppEnv> {
  const out = mapping.toResponse ?? ((row: T): unknown => row);
  return extra(authedRouter(d))
    .get('/', async (c) => {
      const page = await svc.list(
        c.get('user').id,
        parsePageQuery(c.req.query()),
      );
      return c.json(sendPage(c, { ...page, items: page.items.map(out) }));
    })
    .get('/:id', async (c) => {
      const row = await svc.getOne(c.get('user').id, uuidParam(c, 'id'));
      if (!row) throw new NotFoundError('Non trouvé');
      return c.json(out(row));
    })
    .post('/', async (c) => {
      const body = await jsonObject(c);
      // E2EE : le front fixe l'id pour lier le blob chiffré à sa ligne (cf. clientRowId).
      const row = await svc.create(c.get('user').id, {
        ...mapping.toCreateValues(body),
        ...clientRowId(body),
      });
      return c.json(out(row), 201);
    })
    .put('/:id', async (c) => {
      const id = uuidParam(c, 'id');
      const row = await svc.update(
        c.get('user').id,
        id,
        mapping.toUpdatePatch(await jsonObject(c)),
      );
      if (!row) throw new NotFoundError('Non trouvé');
      return c.json(out(row));
    })
    .delete('/:id', async (c) => {
      await svc.remove(c.get('user').id, uuidParam(c, 'id'));
      return c.body(null, 204);
    });
}
