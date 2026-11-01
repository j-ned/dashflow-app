import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  jsonInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import type { EnvelopesService } from '../../modules/envelopes/envelopes.service';

// Couvre le DTO de sortie (toEnvelopeResponse) : `userId` ne doit jamais fuiter dans la
// réponse HTTP, et les routes CRUD (list/getOne/create/update) doivent rester montées à côté
// des routes propres au module, avec le re-mapping de la réponse.

const ID = '11111111-1111-4111-8111-111111111111';

const ENV_ROW = {
  id: ID,
  userId: 'u1',
  memberId: null,
  name: 'Vacances',
  type: 'vacances',
  balance: '100.00',
  target: null,
  color: null,
  dueDay: null,
  encryptedData: null,
};

function envelopesMock() {
  return {
    list: vi.fn().mockResolvedValue({ items: [ENV_ROW], nextCursor: null }),
    getOne: vi.fn().mockResolvedValue(ENV_ROW),
    create: vi.fn().mockResolvedValue(ENV_ROW),
    update: vi.fn().mockResolvedValue(ENV_ROW),
    remove: vi.fn().mockResolvedValue(undefined),
    credit: vi.fn(),
    addTransaction: vi.fn(),
    allTransactions: vi.fn(),
    transactionsOf: vi.fn(),
  };
}

async function setup() {
  const svc = envelopesMock();
  const t = await honoTestApp({
    envelopes: svc as unknown as EnvelopesService,
  });
  return { svc, t };
}

type Json = Record<string, unknown>;

describe('Routes /envelopes (Hono) — DTO de sortie', () => {
  it('GET /envelopes → 200, tableau mappé sans userId', async () => {
    const { t } = await setup();
    const res = await t.authed('/envelopes');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      {
        id: ID,
        memberId: null,
        name: 'Vacances',
        type: 'vacances',
        balance: '100.00',
        target: null,
        color: null,
        dueDay: null,
        encryptedData: null,
      },
    ]);
  });

  it('GET /envelopes/:id → 200, objet mappé sans userId', async () => {
    const { t } = await setup();
    const res = await t.authed(`/envelopes/${ID}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Json;
    expect(body.userId).toBeUndefined();
    expect(body.id).toBe(ID);
  });

  it('POST /envelopes → 201, réponse mappée sans userId', async () => {
    const { t } = await setup();
    const res = await t.authed(
      '/envelopes',
      jsonInit('POST', { name: 'Vacances', type: 'vacances' }),
    );
    expect(res.status).toBe(201);
    expect(((await res.json()) as Json).userId).toBeUndefined();
  });

  it('PUT /envelopes/:id → 200, réponse mappée sans userId', async () => {
    const { t } = await setup();
    const res = await t.authed(
      `/envelopes/${ID}`,
      jsonInit('PUT', { name: 'Vacances 2026', type: 'vacances' }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as Json).userId).toBeUndefined();
  });

  it.each([
    ['NaN (chaîne)', { amount: 'NaN' }],
    ['Infinity', { amount: Number.POSITIVE_INFINITY }],
    ['3 décimales', { amount: 1.005 }],
    ['texte', { amount: 'abc' }],
    ['notation scientifique', { amount: '1e21' }],
  ])(
    'PATCH /envelopes/:id/balance avec %s → 400, service jamais appelé',
    async (_l, body) => {
      const { svc, t } = await setup();
      const res = await t.authed(
        `/envelopes/${ID}/balance`,
        jsonInit('PATCH', body),
      );
      expect(res.status).toBe(400);
      expect(svc.credit).not.toHaveBeenCalled();
    },
  );

  it('PATCH /envelopes/:id/balance accepte un retrait (montant négatif à 2 décimales)', async () => {
    const { svc, t } = await setup();
    svc.credit.mockResolvedValue({ ...ENV_ROW, balance: '-2.50' });
    const res = await t.authed(
      `/envelopes/${ID}/balance`,
      jsonInit('PATCH', { amount: '-2.5' }),
    );
    expect(res.status).toBe(200);
    expect(svc.credit).toHaveBeenCalledWith(TEST_USER.id, ID, {
      amount: -2.5,
      date: undefined,
      note: null,
    });
  });

  it('POST /envelopes avec un objectif négatif → 400', async () => {
    const { svc, t } = await setup();
    const res = await t.authed(
      '/envelopes',
      jsonInit('POST', { name: 'Vacances', type: 'vacances', target: -100 }),
    );
    expect(res.status).toBe(400);
    expect(svc.create).not.toHaveBeenCalled();
  });
});
