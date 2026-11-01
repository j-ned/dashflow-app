import type { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import { parsePageQuery } from '../../common/crud/keyset';
import { parseBody } from '../../common/parse-body';
import { today } from '../../common/today';
import {
  createEncryptedEnvelopeSchema,
  createEnvelopeSchema,
  creditEncryptedEnvelopeSchema,
  creditEnvelopeSchema,
  envelopeTransactionSchema,
  updateEncryptedEnvelopeSchema,
  updateEnvelopeSchema,
} from '../../modules/envelopes/dto/envelope.dto';
import { toEnvelopeResponse } from '../../modules/envelopes/envelope.response';
import type { HttpDeps } from '../deps';
import { sendPage, uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /envelopes (contrôleur Nest EnvelopesController). */
export function envelopesRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.envelopes,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, memberId } = parseBody(
            createEncryptedEnvelopeSchema,
            body,
          );
          return {
            memberId: memberId ?? null,
            name: '',
            type: 'épargne',
            encryptedData,
          };
        }
        const v = parseBody(createEnvelopeSchema, body);
        return {
          memberId: v.memberId ?? null,
          name: v.name,
          type: v.type,
          balance: v.balance ?? '0',
          target: v.target ?? null,
          color: v.color ?? null,
          dueDay: v.dueDay ?? null,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const v = parseBody(updateEncryptedEnvelopeSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: v.encryptedData,
          };
          if (v.memberId !== undefined) patch.memberId = v.memberId;
          return patch;
        }
        const v = parseBody(updateEnvelopeSchema, body);
        const patch: Record<string, unknown> = {};
        if (v.memberId !== undefined) patch.memberId = v.memberId;
        if (v.name !== undefined) patch.name = v.name;
        if (v.type !== undefined) patch.type = v.type;
        if (v.balance !== undefined) patch.balance = v.balance;
        if (v.target !== undefined) patch.target = v.target;
        if (v.color !== undefined) patch.color = v.color;
        if (v.dueDay !== undefined) patch.dueDay = v.dueDay;
        return patch;
      },
      // list / getOne / create / update renvoient le DTO public, comme les surcharges Nest.
      toResponse: toEnvelopeResponse,
    },
    (r) =>
      r
        // Chemin statique avant /:id, sinon capturé par la route paramétrée.
        .get('/transactions/all', async (c) => {
          return c.json(
            sendPage(
              c,
              await d.envelopes.allTransactions(
                c.get('user').id,
                parsePageQuery(c.req.query()),
              ),
            ),
          );
        })
        .get('/:id/transactions', async (c) => {
          const page = await d.envelopes.transactionsOf(
            c.get('user').id,
            uuidParam(c, 'id'),
            parsePageQuery(c.req.query()),
          );
          if (page === undefined) throw new NotFoundError('Non trouvé');
          return c.json(sendPage(c, page));
        })
        .post('/:id/transactions', async (c) => {
          const userId = c.get('user').id;
          const id = uuidParam(c, 'id');
          const body = await jsonObject(c);
          if (body.encryptedData) {
            const row = await d.envelopes.addTransaction(userId, id, {
              ...clientRowId(body),
              amount: '0',
              date: today(),
              encryptedData: body.encryptedData as string,
            });
            if (row === undefined) throw new NotFoundError('Non trouvé');
            return c.json(row, 201);
          }
          // En clair, un mouvement DOIT tenir le solde : même chemin atomique que PATCH /:id/balance.
          const v = parseBody(envelopeTransactionSchema, body);
          const env = await d.envelopes.credit(userId, id, {
            amount: v.amount,
            date: v.date,
            note: v.note ?? null,
          });
          if (env === undefined) throw new NotFoundError('Non trouvé');
          return c.json(toEnvelopeResponse(env), 201);
        })
        .patch('/:id/balance', async (c) => {
          const userId = c.get('user').id;
          const id = uuidParam(c, 'id');
          const body = await jsonObject(c);
          if (body.encryptedData) {
            const { encryptedData } = parseBody(
              creditEncryptedEnvelopeSchema,
              body,
            );
            const row = await d.envelopes.credit(userId, id, { encryptedData });
            if (row === undefined) throw new NotFoundError('Non trouvé');
            return c.json(toEnvelopeResponse(row));
          }
          const v = parseBody(creditEnvelopeSchema, body);
          const row = await d.envelopes.credit(userId, id, {
            amount: v.amount,
            date: v.date,
            note: v.note ?? null,
          });
          if (row === undefined) throw new NotFoundError('Non trouvé');
          return c.json(toEnvelopeResponse(row));
        }),
  );
}
