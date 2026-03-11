import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { appointments } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createAppointmentSchema, updateAppointmentStatusSchema, createEncryptedAppointmentSchema } from '../validation.js';

const appointmentRoutes = new Hono<AppEnv>();

// GET all
appointmentRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(appointments).where(eq(appointments.userId, userId)).limit(100);
  return c.json(rows);
});

// GET by id
appointmentRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
appointmentRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedAppointmentSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(appointments).values({
      userId,
      patientId: v.data.patientId,
      practitionerId: v.data.practitionerId,
      date: '1970-01-01',
      time: '00:00',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createAppointmentSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(appointments).values({
    userId,
    patientId: v.data.patientId,
    practitionerId: v.data.practitionerId,
    date: v.data.date,
    time: v.data.time,
    status: v.data.status ?? 'scheduled',
    reason: v.data.reason ?? null,
    outcome: v.data.outcome ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
appointmentRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.patientId !== undefined) setData.patientId = body.patientId;
    if (body.practitionerId !== undefined) setData.practitionerId = body.practitionerId;
    const [row] = await db.update(appointments)
      .set(setData)
      .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(appointments)
    .set(data)
    .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// PATCH update status
appointmentRoutes.patch('/:id/status', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const v = validate(updateAppointmentStatusSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.update(appointments)
    .set({ status: v.data.status })
    .where(and(eq(appointments.id, id), eq(appointments.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// DELETE
appointmentRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(appointments).where(and(eq(appointments.id, id), eq(appointments.userId, userId)));
  return c.body(null, 204);
});

export default appointmentRoutes;
