import crypto from 'node:crypto';
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { sharedAccess, users } from '@db/schema';
import { sendCalendarInvitation } from '../mail/mailer.js';
import type { AppEnv } from '../types.js';
import { validate, createSharedAccessSchema } from '../validation.js';

const sharedAccessRoutes = new Hono<AppEnv>();

// GET all
sharedAccessRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(sharedAccess).where(eq(sharedAccess.userId, userId)).limit(100);
  return c.json(rows);
});

// POST create
sharedAccessRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const v = validate(createSharedAccessSchema, await c.req.json());
  if (!v.success) return c.json({ error: v.error }, 400);
  const calendarToken = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const [row] = await db.insert(sharedAccess).values({
    userId,
    invitedEmail: v.data.invitedEmail,
    calendarToken,
  }).returning();

  // Send invitation email (non-blocking)
  const [user] = await db.select({ displayName: users.displayName, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const senderName = user?.displayName ?? user?.email ?? 'Un utilisateur DashFlow';

  sendCalendarInvitation(v.data.invitedEmail, senderName, calendarToken).catch((err) => {
    console.error('Failed to send calendar invitation email:', err);
  });

  return c.json(row, 201);
});

// DELETE
sharedAccessRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  await db.delete(sharedAccess).where(and(eq(sharedAccess.id, id), eq(sharedAccess.userId, userId)));
  return c.body(null, 204);
});

export default sharedAccessRoutes;
