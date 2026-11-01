import { describe, it, expect, vi } from 'vitest';
import { honoTestApp, jsonInit } from '../../../test/support/hono-test-app';
import type { LoansService } from '../../modules/loans/loans.service';

// Couvre le DTO de sortie (toLoanResponse) : `userId` ne doit jamais fuiter dans la
// réponse HTTP, et les routes CRUD (list/getOne/create/update) doivent rester montées à côté
// des routes propres au module, avec le re-mapping de la réponse.

const ID = '11111111-1111-4111-8111-111111111111';

const LOAN_ROW = {
  id: ID,
  userId: 'u1',
  memberId: null,
  person: 'Alice',
  direction: 'lent',
  amount: '100.00',
  remaining: '100.00',
  description: null,
  date: '2026-01-01',
  dueDate: null,
  dueDay: null,
  encryptedData: null,
};

function loansMock() {
  return {
    list: vi.fn().mockResolvedValue({ items: [LOAN_ROW], nextCursor: null }),
    getOne: vi.fn().mockResolvedValue(LOAN_ROW),
    create: vi.fn().mockResolvedValue(LOAN_ROW),
    update: vi.fn().mockResolvedValue(LOAN_ROW),
    remove: vi.fn().mockResolvedValue(undefined),
    recordPayment: vi.fn(),
    addTransaction: vi.fn(),
    allTransactions: vi.fn(),
    transactionsOf: vi.fn(),
  };
}

const app = () =>
  honoTestApp({ loans: loansMock() as unknown as LoansService });

type Json = Record<string, unknown>;

describe('Routes /loans (Hono) — DTO de sortie', () => {
  it('GET /loans → 200, tableau mappé sans userId', async () => {
    const res = await (await app()).authed('/loans');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: ID,
        memberId: null,
        person: 'Alice',
        direction: 'lent',
        amount: '100.00',
        remaining: '100.00',
        description: null,
        date: '2026-01-01',
        dueDate: null,
        dueDay: null,
        encryptedData: null,
      },
    ]);
  });

  it('GET /loans/:id → 200, objet mappé sans userId', async () => {
    const res = await (await app()).authed(`/loans/${ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    expect(body.userId).toBeUndefined();
    expect(body.id).toBe(ID);
  });

  it('POST /loans → 201, réponse mappée sans userId', async () => {
    const payload = {
      person: 'Alice',
      direction: 'lent',
      amount: 100,
      remaining: 100,
      date: '2026-01-01',
    };
    const res = await (await app()).authed('/loans', jsonInit('POST', payload));
    expect(res.status).toBe(201);
    expect(((await res.json()) as Json).userId).toBeUndefined();
  });

  it('PUT /loans/:id → 200, réponse mappée sans userId', async () => {
    const payload = {
      person: 'Alice B.',
      direction: 'lent',
      amount: 100,
      remaining: 90,
      date: '2026-01-01',
    };
    const res = await (
      await app()
    ).authed(`/loans/${ID}`, jsonInit('PUT', payload));
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).userId).toBeUndefined();
  });
});
