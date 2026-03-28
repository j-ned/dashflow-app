import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { bankAccounts } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createBankAccountSchema, createEncryptedBankAccountSchema } from '../validation.js';

const bankAccountRoutes = new Hono<AppEnv>();

// GET all
bankAccountRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
  return c.json(rows);
});

// POST create
bankAccountRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedBankAccountSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(bankAccounts).values({
      userId,
      name: '',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createBankAccountSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(bankAccounts).values({
    userId,
    name: v.data.name,
    initialBalance: String(v.data.initialBalance ?? 0),
    color: v.data.color ?? null,
    dotColor: v.data.dotColor ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
bankAccountRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const [row] = await db.update(bankAccounts)
      .set({ encryptedData: body.encryptedData })
      .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, createdAt: _ca, ...data } = body;
  const [row] = await db.update(bankAccounts)
    .set(data)
    .where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// DELETE
bankAccountRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(bankAccounts).where(and(eq(bankAccounts.id, id), eq(bankAccounts.userId, userId)));
  return c.body(null, 204);
});

export default bankAccountRoutes;
