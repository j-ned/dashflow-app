import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { patients } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, updateMemberColorSchema } from '../validation.js';

const memberRoutes = new Hono<AppEnv>();

// GET all — returns patients as family members
memberRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select({
    id: patients.id,
    firstName: patients.firstName,
    lastName: patients.lastName,
    color: patients.color,
    encryptedData: patients.encryptedData,
  }).from(patients).where(eq(patients.userId, userId)).limit(100);
  return c.json(rows);
});

// PATCH /:id/color — update member badge color
memberRoutes.patch('/:id/color', async (c) => {
  const userId = c.get('userId') as string;
  const { id } = c.req.param();
  const v = validate(updateMemberColorSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const [updated] = await db.update(patients)
    .set({ color: v.data.color })
    .where(and(eq(patients.id, id), eq(patients.userId, userId)))
    .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, color: patients.color });
  if (!updated) return c.json({ error: 'Not found' }, 404);
  return c.json(updated);
});

export default memberRoutes;
