import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { practitioners } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createPractitionerSchema, createEncryptedPractitionerSchema } from '../validation.js';

const practitionerRoutes = new Hono<AppEnv>();

// GET all
practitionerRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(practitioners).where(eq(practitioners.userId, userId)).limit(100);
  return c.json(rows);
});

// GET by id
practitionerRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(practitioners)
    .where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
practitionerRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedPractitionerSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(practitioners).values({
      userId,
      name: '',
      type: 'autre',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createPractitionerSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(practitioners).values({
    userId,
    name: v.data.name,
    type: v.data.type,
    phone: v.data.phone ?? null,
    email: v.data.email ?? null,
    address: v.data.address ?? null,
    bookingUrl: v.data.bookingUrl ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
practitionerRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const [row] = await db.update(practitioners)
      .set({ encryptedData: body.encryptedData })
      .where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(practitioners)
    .set(data)
    .where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// DELETE
practitionerRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(practitioners).where(and(eq(practitioners.id, id), eq(practitioners.userId, userId)));
  return c.body(null, 204);
});

export default practitionerRoutes;
