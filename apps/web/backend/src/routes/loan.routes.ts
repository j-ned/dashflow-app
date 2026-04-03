import { Hono } from 'hono';
import { eq, and, desc, getTableColumns } from 'drizzle-orm';
import { db } from '@db/client';
import { loans, loanTransactions } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createLoanSchema, loanPaymentSchema, envelopeTransactionSchema, createEncryptedLoanSchema } from '../validation.js';

const loanRoutes = new Hono<AppEnv>();

// GET all
loanRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(loans).where(eq(loans.userId, userId)).limit(100);
  return c.json(rows);
});

// GET by id
loanRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
loanRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedLoanSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(loans).values({
      userId,
      memberId: v.data.memberId ?? null,
      person: '',
      direction: v.data.direction ?? 'lent',
      amount: '0',
      remaining: '0',
      date: new Date().toISOString().slice(0, 10),
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createLoanSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(loans).values({
    userId,
    memberId: v.data.memberId ?? null,
    person: v.data.person,
    direction: v.data.direction,
    amount: v.data.amount,
    remaining: v.data.remaining,
    date: v.data.date,
    description: v.data.description ?? null,
    dueDate: v.data.dueDate ?? null,
    dueDay: v.data.dueDay ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
loanRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.memberId !== undefined) setData.memberId = body.memberId;
    if (body.direction) setData.direction = body.direction;
    const [row] = await db.update(loans)
      .set(setData)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(loans)
    .set(data)
    .where(and(eq(loans.id, id), eq(loans.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// GET all transactions for user (migration/encryption) — single JOIN query
loanRoutes.get('/transactions/all', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db
    .select(getTableColumns(loanTransactions))
    .from(loanTransactions)
    .innerJoin(loans, and(
      eq(loanTransactions.loanId, loans.id),
      eq(loans.userId, userId),
    ))
    .limit(1000);
  return c.json(rows);
});

// GET transactions for a loan
loanRoutes.get('/:id/transactions', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [loan] = await db.select().from(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, userId)))
    .limit(1);
  if (!loan) return c.json({ error: 'Non trouve' }, 404);

  const rows = await db.select().from(loanTransactions)
    .where(eq(loanTransactions.loanId, id))
    .orderBy(desc(loanTransactions.date), desc(loanTransactions.createdAt))
    .limit(100);
  return c.json(rows);
});

// POST transaction
loanRoutes.post('/:id/transactions', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  const [loan] = await db.select().from(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, userId)))
    .limit(1);
  if (!loan) return c.json({ error: 'Non trouve' }, 404);

  if (body.encryptedData) {
    const [row] = await db.insert(loanTransactions).values({
      loanId: id,
      amount: '0',
      date: new Date().toISOString().slice(0, 10),
      encryptedData: body.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(envelopeTransactionSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(loanTransactions).values({
    loanId: id,
    amount: String(v.data.amount),
    date: v.data.date,
  }).returning();
  return c.json(row, 201);
});

// PATCH record payment (kept for backward compat)
loanRoutes.patch('/:id/payment', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const v = validate(loanPaymentSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { amount, date } = v.data;

  const [current] = await db.select().from(loans)
    .where(and(eq(loans.id, id), eq(loans.userId, userId)))
    .limit(1);
  if (!current) return c.json({ error: 'Non trouve' }, 404);

  const txDate = date || new Date().toISOString().slice(0, 10);
  const newRemaining = String(Math.max(0, Number(current.remaining) - amount));

  const row = await db.transaction(async (tx) => {
    const [updated] = await tx.update(loans)
      .set({ remaining: newRemaining })
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();
    await tx.insert(loanTransactions).values({
      loanId: id,
      amount: String(amount),
      date: txDate,
    });
    return updated;
  });

  return c.json(row);
});

// DELETE
loanRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(loans).where(and(eq(loans.id, id), eq(loans.userId, userId)));
  return c.body(null, 204);
});

export default loanRoutes;
