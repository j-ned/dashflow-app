import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { reminders } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createReminderSchema } from '../validation.js';

const reminderRoutes = new Hono<AppEnv>();

// GET all
reminderRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(reminders).where(eq(reminders.userId, userId)).limit(100);
  return c.json(rows);
});

// GET by id
reminderRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
reminderRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const v = validate(createReminderSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(reminders).values({
    userId,
    type: v.data.type,
    target: v.data.target,
    medicationId: v.data.medicationId ?? null,
    appointmentId: v.data.appointmentId ?? null,
    recipientEmail: v.data.recipientEmail,
    enabled: v.data.enabled ?? true,
  }).returning();
  return c.json(row, 201);
});

// PUT update
reminderRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();
  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(reminders)
    .set(data)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// PATCH toggle enabled
reminderRoutes.patch('/:id/toggle', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [current] = await db.select().from(reminders)
    .where(and(eq(reminders.id, id), eq(reminders.userId, userId)))
    .limit(1);
  if (!current) return c.json({ error: 'Non trouve' }, 404);

  const [row] = await db.update(reminders)
    .set({ enabled: !current.enabled })
    .where(eq(reminders.id, id))
    .returning();
  return c.json(row);
});

// DELETE
reminderRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(reminders).where(and(eq(reminders.id, id), eq(reminders.userId, userId)));
  return c.body(null, 204);
});

export default reminderRoutes;
