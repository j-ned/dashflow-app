import type { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import { parsePageQuery } from '../../common/crud/keyset';
import { parseBody } from '../../common/parse-body';
import { toBankAccountResponse } from '../../modules/bank-accounts/bank-account.response';
import {
  createBankAccountSchema,
  createEncryptedBankAccountSchema,
  updateBankAccountSchema,
  updateEncryptedBankAccountSchema,
} from '../../modules/bank-accounts/dto/bank-account.dto';
import type { HttpDeps } from '../deps';
import { sendPage, uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { authedRouter } from './owned-crud';

/**
 * Routes /bank-accounts (contrôleur Nest BankAccountsController). Pas d'OwnedCrudController :
 * aucune route GET /:id sous Nest, on ne l'ajoute pas ici.
 */
export function bankAccountsRoutes(d: HttpDeps): Hono<AppEnv> {
  return authedRouter(d)
    .get('/', async (c) => {
      const page = await d.bankAccounts.list(
        c.get('user').id,
        parsePageQuery(c.req.query()),
      );
      return c.json(
        sendPage(c, { ...page, items: page.items.map(toBankAccountResponse) }),
      );
    })
    .post('/', async (c) => {
      const userId = c.get('user').id;
      const body = await jsonObject(c);
      if (body.encryptedData) {
        const { encryptedData } = parseBody(
          createEncryptedBankAccountSchema,
          body,
        );
        // E2EE : seul le chemin chiffré accepte l'id fixé par le front (cf. clientRowId).
        const row = await d.bankAccounts.create(userId, {
          name: '',
          encryptedData,
          ...clientRowId(body),
        });
        return c.json(toBankAccountResponse(row), 201);
      }
      const v = parseBody(createBankAccountSchema, body);
      const row = await d.bankAccounts.create(userId, {
        name: v.name,
        type: v.type ?? 'courant',
        initialBalance: String(v.initialBalance ?? 0),
        color: v.color ?? null,
        dotColor: v.dotColor ?? null,
      });
      return c.json(toBankAccountResponse(row), 201);
    })
    .put('/:id', async (c) => {
      const id = uuidParam(c, 'id');
      const body = await jsonObject(c);
      let patch: Record<string, unknown>;
      if (body.encryptedData) {
        const v = parseBody(updateEncryptedBankAccountSchema, body);
        patch = { encryptedData: v.encryptedData };
      } else {
        const v = parseBody(updateBankAccountSchema, body);
        patch = {};
        if (v.name !== undefined) patch.name = v.name;
        if (v.type !== undefined) patch.type = v.type;
        if (v.initialBalance !== undefined)
          patch.initialBalance = String(v.initialBalance);
        if (v.color !== undefined) patch.color = v.color;
        if (v.dotColor !== undefined) patch.dotColor = v.dotColor;
      }
      const row = await d.bankAccounts.update(c.get('user').id, id, patch);
      if (!row) throw new NotFoundError('Non trouvé');
      return c.json(toBankAccountResponse(row));
    })
    .delete('/:id', async (c) => {
      await d.bankAccounts.remove(c.get('user').id, uuidParam(c, 'id'));
      return c.body(null, 204);
    });
}
