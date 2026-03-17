import { Hono } from 'hono';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { db } from '@db/client';
import { envelopes, envelopeTransactions } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createEnvelopeSchema, creditEnvelopeSchema, envelopeTransactionSchema, createEncryptedEnvelopeSchema, creditEncryptedEnvelopeSchema } from '../validation.js';

const envelopeRoutes = new Hono<AppEnv>();

// GET all
envelopeRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(envelopes).where(eq(envelopes.userId, userId)).limit(100);
  return c.json(rows);
});

// GET by id
envelopeRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(envelopes)
    .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
envelopeRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedEnvelopeSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(envelopes).values({
      userId,
      memberId: v.data.memberId ?? null,
      name: '',
      type: 'épargne',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createEnvelopeSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(envelopes).values({
    userId,
    memberId: v.data.memberId ?? null,
    name: v.data.name,
    type: v.data.type,
    balance: v.data.balance ?? '0',
    target: v.data.target ?? null,
    color: v.data.color ?? null,
    dueDay: v.data.dueDay ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
envelopeRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.memberId !== undefined) setData.memberId = body.memberId;
    const [row] = await db.update(envelopes)
      .set(setData)
      .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(envelopes)
    .set(data)
    .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// GET all transactions for user (migration/encryption)
envelopeRoutes.get('/transactions/all', async (c) => {
  const userId = c.get('userId') as string;
  const userEnvelopes = await db.select({ id: envelopes.id }).from(envelopes)
    .where(eq(envelopes.userId, userId));
  if (userEnvelopes.length === 0) return c.json([]);
  const ids = userEnvelopes.map(e => e.id);
  const rows = await db.select().from(envelopeTransactions)
    .where(inArray(envelopeTransactions.envelopeId, ids))
    .limit(1000);
  return c.json(rows);
});

// GET transactions for an envelope
envelopeRoutes.get('/:id/transactions', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [envelope] = await db.select().from(envelopes)
    .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
    .limit(1);
  if (!envelope) return c.json({ error: 'Non trouve' }, 404);

  const rows = await db.select().from(envelopeTransactions)
    .where(eq(envelopeTransactions.envelopeId, id))
    .orderBy(desc(envelopeTransactions.date), desc(envelopeTransactions.createdAt))
    .limit(100);
  return c.json(rows);
});

// POST transaction
envelopeRoutes.post('/:id/transactions', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  const [envelope] = await db.select().from(envelopes)
    .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
    .limit(1);
  if (!envelope) return c.json({ error: 'Non trouve' }, 404);

  if (body.encryptedData) {
    const [row] = await db.insert(envelopeTransactions).values({
      envelopeId: id,
      amount: '0',
      date: new Date().toISOString().slice(0, 10),
      encryptedData: body.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(envelopeTransactionSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(envelopeTransactions).values({
    envelopeId: id,
    amount: String(v.data.amount),
    date: v.data.date,
  }).returning();
  return c.json(row, 201);
});

// PATCH credit balance (kept for backward compat — will be removed when all clients use E2EE)
envelopeRoutes.patch('/:id/balance', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  const [current] = await db.select().from(envelopes)
    .where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)))
    .limit(1);
  if (!current) return c.json({ error: 'Non trouve' }, 404);

  if (body.encryptedData) {
    const v = validate(creditEncryptedEnvelopeSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);

    const [row] = await db.update(envelopes)
      .set({ encryptedData: v.data.encryptedData })
      .where(eq(envelopes.id, id))
      .returning();

    await db.insert(envelopeTransactions).values({
      envelopeId: id,
      amount: '0',
      date: new Date().toISOString().slice(0, 10),
      encryptedData: v.data.encryptedData,
    });

    return c.json(row);
  }

  const v = validate(creditEnvelopeSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const { amount, date } = v.data;

  const txDate = date || new Date().toISOString().slice(0, 10);
  const newBalance = String(Number(current.balance) + amount);
  const updateData: Record<string, any> = { balance: newBalance };

  if (current.target) {
    const newTarget = Math.max(0, Number(current.target) - amount);
    updateData.target = String(newTarget);
  }

  const [row] = await db.update(envelopes)
    .set(updateData)
    .where(eq(envelopes.id, id))
    .returning();

  await db.insert(envelopeTransactions).values({
    envelopeId: id,
    amount: String(amount),
    date: txDate,
  });

  return c.json(row);
});

// DELETE
envelopeRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(envelopes).where(and(eq(envelopes.id, id), eq(envelopes.userId, userId)));
  return c.body(null, 204);
});

export default envelopeRoutes;
