import { describe, it, expect, vi } from 'vitest';
import { honoTestApp, jsonInit } from '../../../test/support/hono-test-app';
import type { BankAccountsService } from '../../modules/bank-accounts/bank-accounts.service';

// Couvre le DTO de sortie (toBankAccountResponse) : `userId` ne doit jamais fuiter dans
// la réponse HTTP des routes list/create/update.

const ID = '11111111-1111-4111-8111-111111111111';

const ACCOUNT_ROW = {
  id: ID,
  userId: 'u1',
  name: 'Compte courant',
  type: 'courant',
  initialBalance: '0',
  color: null,
  dotColor: null,
  encryptedData: null,
  createdAt: new Date('2026-01-01'),
};

function bankAccountsMock() {
  return {
    list: vi.fn().mockResolvedValue({ items: [ACCOUNT_ROW], nextCursor: null }),
    create: vi.fn().mockResolvedValue(ACCOUNT_ROW),
    update: vi.fn().mockResolvedValue(ACCOUNT_ROW),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

const app = () =>
  honoTestApp({
    bankAccounts: bankAccountsMock() as unknown as BankAccountsService,
  });

type Json = Record<string, unknown>;

describe('Routes /bank-accounts (Hono) — DTO de sortie', () => {
  it('GET /bank-accounts → 200, tableau mappé sans userId', async () => {
    const res = await (await app()).authed('/bank-accounts');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json[];
    expect(body[0]?.userId).toBeUndefined();
    expect(body[0]?.id).toBe(ID);
  });

  it('POST /bank-accounts → 201, réponse mappée sans userId', async () => {
    const res = await (
      await app()
    ).authed('/bank-accounts', jsonInit('POST', { name: 'Compte courant' }));
    expect(res.status).toBe(201);
    expect(((await res.json()) as Json).userId).toBeUndefined();
  });

  it('PUT /bank-accounts/:id → 200, réponse mappée sans userId', async () => {
    const res = await (
      await app()
    ).authed(
      `/bank-accounts/${ID}`,
      jsonInit('PUT', { name: 'Compte courant 2' }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).userId).toBeUndefined();
  });
});
