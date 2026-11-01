import type { Hono } from 'hono';
import { NotFoundError } from '../../common/errors';
import { clientRowId } from '../../common/crud/client-row-id';
import { parsePageQuery } from '../../common/crud/keyset';
import { parseBody } from '../../common/parse-body';
import { today } from '../../common/today';
import {
  createEncryptedLoanSchema,
  createLoanSchema,
  loanPaymentSchema,
  loanTransactionSchema,
  updateEncryptedLoanSchema,
  updateLoanSchema,
} from '../../modules/loans/dto/loan.dto';
import { toLoanResponse } from '../../modules/loans/loan.response';
import type { HttpDeps } from '../deps';
import { sendPage, uuidParam } from '../kit';
import type { AppEnv } from '../types';
import { jsonObject } from '../validate';
import { ownedCrudRoutes } from './owned-crud';

/** Routes /loans (contrôleur Nest LoansController). */
export function loansRoutes(d: HttpDeps): Hono<AppEnv> {
  return ownedCrudRoutes(
    d,
    d.loans,
    {
      toCreateValues(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const { encryptedData, memberId, direction } = parseBody(
            createEncryptedLoanSchema,
            body,
          );
          return {
            memberId: memberId ?? null,
            person: '',
            direction: direction ?? 'lent',
            amount: '0',
            remaining: '0',
            date: today(),
            encryptedData,
          };
        }
        const v = parseBody(createLoanSchema, body);
        return {
          memberId: v.memberId ?? null,
          person: v.person,
          direction: v.direction,
          amount: v.amount,
          remaining: v.remaining,
          date: v.date,
          description: v.description ?? null,
          dueDate: v.dueDate ?? null,
          dueDay: v.dueDay ?? null,
        };
      },
      toUpdatePatch(body: Record<string, unknown>): Record<string, unknown> {
        if (body.encryptedData) {
          const v = parseBody(updateEncryptedLoanSchema, body);
          const patch: Record<string, unknown> = {
            encryptedData: v.encryptedData,
          };
          if (v.memberId !== undefined) patch.memberId = v.memberId;
          if (v.direction !== undefined) patch.direction = v.direction;
          return patch;
        }
        const v = parseBody(updateLoanSchema, body);
        const patch: Record<string, unknown> = {};
        if (v.memberId !== undefined) patch.memberId = v.memberId;
        if (v.person !== undefined) patch.person = v.person;
        if (v.direction !== undefined) patch.direction = v.direction;
        if (v.amount !== undefined) patch.amount = v.amount;
        if (v.remaining !== undefined) patch.remaining = v.remaining;
        if (v.description !== undefined) patch.description = v.description;
        if (v.date !== undefined) patch.date = v.date;
        if (v.dueDate !== undefined) patch.dueDate = v.dueDate;
        if (v.dueDay !== undefined) patch.dueDay = v.dueDay;
        return patch;
      },
      // list / getOne / create / update renvoient le DTO public, comme les surcharges Nest.
      toResponse: toLoanResponse,
    },
    (r) =>
      r
        // Chemin statique avant /:id, sinon capturé par la route paramétrée.
        .get('/transactions/all', async (c) => {
          return c.json(
            sendPage(
              c,
              await d.loans.allTransactions(
                c.get('user').id,
                parsePageQuery(c.req.query()),
              ),
            ),
          );
        })
        .get('/:id/transactions', async (c) => {
          const page = await d.loans.transactionsOf(
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
            const row = await d.loans.addTransaction(userId, id, {
              ...clientRowId(body),
              amount: '0',
              date: today(),
              encryptedData: body.encryptedData as string,
            });
            if (row === undefined) throw new NotFoundError('Non trouvé');
            return c.json(row, 201);
          }
          // En clair, un remboursement DOIT tenir le restant dû : même chemin atomique que PATCH /:id/payment.
          const v = parseBody(loanTransactionSchema, body);
          const loan = await d.loans.recordPayment(userId, id, {
            amount: v.amount,
            date: v.date,
          });
          if (loan === undefined) throw new NotFoundError('Non trouvé');
          return c.json(toLoanResponse(loan), 201);
        })
        .patch('/:id/payment', async (c) => {
          const id = uuidParam(c, 'id');
          const v = parseBody(loanPaymentSchema, await jsonObject(c));
          const row = await d.loans.recordPayment(c.get('user').id, id, {
            amount: v.amount,
            date: v.date,
            note: v.note ?? null,
          });
          if (row === undefined) throw new NotFoundError('Non trouvé');
          return c.json(toLoanResponse(row));
        }),
  );
}
