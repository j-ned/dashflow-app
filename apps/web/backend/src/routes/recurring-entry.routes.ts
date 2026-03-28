import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { recurringEntries } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createRecurringEntrySchema, createEncryptedRecurringEntrySchema } from '../validation.js';
import { salaryPayslipKey, uploadSalaryPayslip, getSalaryPayslip, deleteSalaryPayslip } from '../storage/s3.js';

const recurringEntryRoutes = new Hono<AppEnv>();

// GET all
recurringEntryRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(recurringEntries).where(eq(recurringEntries.userId, userId)).limit(200);
  return c.json(rows);
});

// GET by id
recurringEntryRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(recurringEntries)
    .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST create
recurringEntryRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedRecurringEntrySchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(recurringEntries).values({
      userId,
      memberId: v.data.memberId ?? null,
      accountId: v.data.accountId ?? null,
      label: '',
      amount: '0',
      type: 'income',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(row, 201);
  }

  const v = validate(createRecurringEntrySchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(recurringEntries).values({
    userId,
    memberId: v.data.memberId ?? null,
    accountId: v.data.accountId ?? null,
    toAccountId: v.data.toAccountId ?? null,
    label: v.data.label,
    amount: v.data.amount,
    type: v.data.type,
    dayOfMonth: v.data.dayOfMonth ?? null,
    date: v.data.date ?? null,
    endDate: v.data.endDate ?? null,
    category: v.data.category ?? null,
  }).returning();
  return c.json(row, 201);
});

// PUT update
recurringEntryRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.memberId !== undefined) setData.memberId = body.memberId;
    if (body.accountId !== undefined) setData.accountId = body.accountId;
    const [row] = await db.update(recurringEntries)
      .set(setData)
      .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, createdAt: _ca, ...data } = body;
  const [row] = await db.update(recurringEntries)
    .set(data)
    .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(row);
});

// POST /:id/payslip — upload payslip for an income entry
recurringEntryRoutes.post('/:id/payslip', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db.select().from(recurringEntries)
    .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'Fichier requis' }, 400);

  // Delete old payslip if any
  if (row.payslipKey) {
    await deleteSalaryPayslip(row.payslipKey);
  }

  const key = salaryPayslipKey(userId, id, file.type);
  await uploadSalaryPayslip(key, await file.arrayBuffer(), file.type);

  const [updated] = await db.update(recurringEntries)
    .set({ payslipKey: key })
    .where(eq(recurringEntries.id, id))
    .returning();

  return c.json(updated);
});

// GET /:id/payslip — download payslip
recurringEntryRoutes.get('/:id/payslip', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db.select().from(recurringEntries)
    .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
    .limit(1);
  if (!row?.payslipKey) return c.json({ error: 'Pas de fiche de paie' }, 404);

  const result = await getSalaryPayslip(row.payslipKey);
  if (!result) return c.json({ error: 'Fichier introuvable' }, 404);

  return new Response(result.body, {
    headers: { 'Content-Type': result.contentType, 'Cache-Control': 'private, max-age=86400' },
  });
});

// DELETE /:id/payslip — remove payslip
recurringEntryRoutes.delete('/:id/payslip', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db.select().from(recurringEntries)
    .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
    .limit(1);
  if (!row?.payslipKey) return c.json({ error: 'Pas de fiche de paie' }, 404);

  await deleteSalaryPayslip(row.payslipKey);
  await db.update(recurringEntries)
    .set({ payslipKey: null })
    .where(eq(recurringEntries.id, id));

  return c.json({ ok: true });
});

// DELETE
recurringEntryRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  // Clean up payslip if exists
  const [row] = await db.select().from(recurringEntries)
    .where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)))
    .limit(1);
  if (row?.payslipKey) {
    await deleteSalaryPayslip(row.payslipKey);
  }

  await db.delete(recurringEntries).where(and(eq(recurringEntries.id, id), eq(recurringEntries.userId, userId)));
  return c.body(null, 204);
});

export default recurringEntryRoutes;
