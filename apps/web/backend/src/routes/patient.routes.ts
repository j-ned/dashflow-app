import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { patients } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createPatientSchema, createEncryptedPatientSchema } from '../validation.js';

const patientRoutes = new Hono<AppEnv>();

// GET all
patientRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(patients).where(eq(patients.userId, userId)).limit(100);
  return c.json(rows);
});

// GET by id
patientRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(patients)
    .where(and(eq(patients.id, id), eq(patients.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
patientRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedPatientSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(patients).values({
      userId,
      firstName: '',
      lastName: '',
      birthDate: '1970-01-01',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createPatientSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(patients).values({
    userId,
    firstName: v.data.firstName,
    lastName: v.data.lastName,
    birthDate: v.data.birthDate,
    notes: v.data.notes ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
patientRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const [row] = await db.update(patients)
      .set({ encryptedData: body.encryptedData })
      .where(and(eq(patients.id, id), eq(patients.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(patients)
    .set(data)
    .where(and(eq(patients.id, id), eq(patients.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// DELETE
patientRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(patients).where(and(eq(patients.id, id), eq(patients.userId, userId)));
  return c.body(null, 204);
});

export default patientRoutes;
