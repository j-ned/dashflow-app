import { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import { parsePageQuery } from '../../common/crud/keyset';
import { parseBody } from '../../common/parse-body';
import { today } from '../../common/today';
import {
  batchTransactionSchema,
  createEncryptedTransactionSchema,
  createTransactionSchema,
  updateEncryptedTransactionSchema,
  updateTransactionSchema,
} from '../../modules/account-transactions/dto/account-transaction.dto';
import type { AccountTransactionsService } from '../../modules/account-transactions/account-transactions.service';
import type { HttpDeps } from '../deps';
import { sendPage, uuidParam } from '../kit';
import { csrfOnMutations, requireAuth } from '../middleware/auth';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';

type TransactionValues = Parameters<
  AccountTransactionsService['addTransaction']
>[2];

/** Corps d'un mouvement (chiffré ou en clair) → valeurs insérées ; partagé par POST et /batch. */
function toTransactionValues(raw: Record<string, unknown>): TransactionValues {
  if (raw.encryptedData) {
    const v = parseBody(createEncryptedTransactionSchema, raw);
    return {
      ...clientRowId(raw),
      amount: '0',
      date: today(),
      direction: v.direction,
      toAccountId: v.toAccountId ?? null,
      memberId: v.memberId ?? null,
      recurringEntryId: v.recurringEntryId ?? null,
      encryptedData: v.encryptedData,
    };
  }
  const v = parseBody(createTransactionSchema, raw);
  return {
    amount: v.amount,
    direction: v.direction,
    date: v.date,
    toAccountId: v.toAccountId ?? null,
    category: v.category ?? null,
    note: v.note ?? null,
    memberId: v.memberId ?? null,
    recurringEntryId: v.recurringEntryId ?? null,
  };
}

/**
 * Routes du contrôleur Nest AccountTransactionsController, SANS préfixe (`@Controller()`) :
 * /transactions/... et /bank-accounts/:accountId/transactions. Monté à la racine, ce routeur
 * pose ses gardes route par route : un `.use()` global s'appliquerait à toute l'app.
 */
export function accountTransactionsRoutes(d: HttpDeps): Hono<AppEnv> {
  const authed = [
    requireAuth(d.sessions),
    csrfOnMutations(d.csrfPolicy),
  ] as const;

  return new Hono<AppEnv>()
    .get('/transactions/all', ...authed, async (c) => {
      return c.json(
        sendPage(
          c,
          await d.accountTransactions.listAll(
            c.get('user').id,
            parsePageQuery(c.req.query()),
          ),
        ),
      );
    })
    .get('/bank-accounts/:accountId/transactions', ...authed, async (c) => {
      const accountId = uuidParam(c, 'accountId');
      return c.json(
        sendPage(
          c,
          await d.accountTransactions.listOfAccount(
            c.get('user').id,
            accountId,
            parsePageQuery(c.req.query()),
          ),
        ),
      );
    })
    .post('/bank-accounts/:accountId/transactions', ...authed, async (c) => {
      const accountId = uuidParam(c, 'accountId');
      const row = await d.accountTransactions.addTransaction(
        c.get('user').id,
        accountId,
        toTransactionValues(await jsonObject(c)),
      );
      if (row === undefined) throw new NotFoundError('Compte non trouvé');
      return c.json(row, 201);
    })
    .post(
      '/bank-accounts/:accountId/transactions/batch',
      ...authed,
      async (c) => {
        const accountId = uuidParam(c, 'accountId');
        const { items } = parseBody(
          batchTransactionSchema,
          await jsonObject(c),
        );
        const rows = await d.accountTransactions.addBatch(
          c.get('user').id,
          accountId,
          items.map(toTransactionValues),
        );
        if (rows === undefined) throw new NotFoundError('Compte non trouvé');
        return c.json(rows, 201);
      },
    )
    .put('/transactions/:id', ...authed, async (c) => {
      const id = uuidParam(c, 'id');
      const body = await jsonObject(c);
      let patch: Record<string, unknown>;
      if (body.encryptedData) {
        const v = parseBody(updateEncryptedTransactionSchema, body);
        patch = { encryptedData: v.encryptedData };
        if (v.direction !== undefined) patch.direction = v.direction;
        if (v.toAccountId !== undefined) patch.toAccountId = v.toAccountId;
        if (v.memberId !== undefined) patch.memberId = v.memberId;
        if (v.recurringEntryId !== undefined)
          patch.recurringEntryId = v.recurringEntryId;
      } else {
        const v = parseBody(updateTransactionSchema, body);
        patch = {};
        if (v.amount !== undefined) patch.amount = v.amount;
        if (v.direction !== undefined) patch.direction = v.direction;
        if (v.toAccountId !== undefined) patch.toAccountId = v.toAccountId;
        if (v.date !== undefined) patch.date = v.date;
        if (v.category !== undefined) patch.category = v.category;
        if (v.note !== undefined) patch.note = v.note;
        if (v.memberId !== undefined) patch.memberId = v.memberId;
        if (v.recurringEntryId !== undefined)
          patch.recurringEntryId = v.recurringEntryId;
      }
      const row = await d.accountTransactions.update(
        c.get('user').id,
        id,
        patch,
      );
      if (!row) throw new NotFoundError('Non trouvé');
      return c.json(row);
    })
    .delete('/transactions/:id', ...authed, async (c) => {
      await d.accountTransactions.remove(c.get('user').id, uuidParam(c, 'id'));
      return c.body(null, 204);
    });
}
