import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { medications } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createMedicationSchema, refillMedicationSchema, createEncryptedMedicationSchema } from '../validation.js';

const medicationRoutes = new Hono<AppEnv>();

// GET all
medicationRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(medications).where(eq(medications.userId, userId)).limit(100);
  return c.json(rows);
});

// GET alerts (medications where daysRemaining <= alertDaysBefore)
medicationRoutes.get('/alerts', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(medications).where(eq(medications.userId, userId)).limit(100);
  const alerts = rows
    .map((med) => {
      const dailyRate = Number(med.dailyRate);
      const skip = (med.skipDays as number[]) ?? [];
      const activeDaysPerWeek = 7 - skip.length;
      const weeklyRate = dailyRate * activeDaysPerWeek;
      const daysRemaining = weeklyRate > 0 ? (med.quantity / weeklyRate) * 7 : Infinity;
      return { ...med, daysRemaining: Math.round(daysRemaining * 100) / 100 };
    })
    .filter((med) => med.daysRemaining <= med.alertDaysBefore);
  return c.json(alerts);
});

// GET by id
medicationRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(medications)
    .where(and(eq(medications.id, id), eq(medications.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
medicationRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedMedicationSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(medications).values({
      userId,
      prescriptionId: v.data.prescriptionId ?? null,
      patientId: v.data.patientId,
      name: '',
      type: 'comprime',
      dosage: '',
      startDate: '1970-01-01',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createMedicationSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(medications).values({
    userId,
    prescriptionId: v.data.prescriptionId ?? null,
    patientId: v.data.patientId,
    name: v.data.name,
    type: v.data.type,
    dosage: v.data.dosage,
    quantity: v.data.quantity ?? 0,
    dailyRate: v.data.dailyRate ?? '1',
    startDate: v.data.startDate,
    alertDaysBefore: v.data.alertDaysBefore ?? 7,
    skipDays: v.data.skipDays ?? [],
  }).returning();
  return c.json(row, 201);
});

// PUT update
medicationRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.prescriptionId !== undefined) setData.prescriptionId = body.prescriptionId ?? null;
    if (body.patientId !== undefined) setData.patientId = body.patientId;
    const [row] = await db.update(medications)
      .set(setData)
      .where(and(eq(medications.id, id), eq(medications.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, ...data } = body;
  const [row] = await db.update(medications)
    .set(data)
    .where(and(eq(medications.id, id), eq(medications.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// PATCH refill (add quantity to existing)
medicationRoutes.patch('/:id/refill', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const v = validate(refillMedicationSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const { quantity } = v.data;

  const [current] = await db.select().from(medications)
    .where(and(eq(medications.id, id), eq(medications.userId, userId)))
    .limit(1);
  if (!current) return c.json({ error: 'Non trouve' }, 404);

  const newQuantity = current.quantity + quantity;
  const [row] = await db.update(medications)
    .set({ quantity: newQuantity })
    .where(eq(medications.id, id))
    .returning();
  return c.json(row);
});

// DELETE
medicationRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(medications).where(and(eq(medications.id, id), eq(medications.userId, userId)));
  return c.body(null, 204);
});

export default medicationRoutes;
