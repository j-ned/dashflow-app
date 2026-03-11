import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../types.js';
import { db } from '@db/client';
import { salaryArchives } from '@db/schema';
import { payslipKey, uploadPayslip, getPayslip, deletePayslip } from '../storage/s3.js';
import { validate, createEncryptedSalaryArchiveSchema } from '../validation.js';

const app = new Hono<AppEnv>();

// GET / — list all archives for the user, sorted by month DESC
app.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db
    .select()
    .from(salaryArchives)
    .where(eq(salaryArchives.userId, userId))
    .orderBy(desc(salaryArchives.month));
  return c.json(rows);
});

// POST / — create an archive (with optional payslip file)
app.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const contentType = c.req.header('content-type') ?? '';

  // E2EE: JSON body with encryptedData
  if (contentType.includes('application/json')) {
    const body = await c.req.json();
    if (body.encryptedData) {
      const v = validate(createEncryptedSalaryArchiveSchema, body);
      if (!v.success) return c.json({ error: v.error }, 400);
      const [row] = await db
        .insert(salaryArchives)
        .values({
          userId,
          accountId: v.data.accountId ?? null,
          month: '0000-00',
          salary: '0',
          encryptedData: v.data.encryptedData,
        })
        .returning();
      return c.json(row, 201);
    }
  }

  const formData = await c.req.formData();

  const month = formData.get('month') as string;
  const salary = formData.get('salary') as string;
  const totalExpenses = formData.get('totalExpenses') as string || '0';
  const totalSpendings = formData.get('totalSpendings') as string || '0';
  const spendingsJson = formData.get('spendings') as string || '[]';
  const accountId = formData.get('accountId') as string | null;
  const file = formData.get('payslip') as File | null;

  const [row] = await db
    .insert(salaryArchives)
    .values({
      userId,
      accountId: accountId || null,
      month,
      salary,
      totalExpenses,
      totalSpendings,
      spendings: JSON.parse(spendingsJson),
    })
    .returning();

  // Upload payslip if provided
  if (file && row) {
    const key = payslipKey(userId, row.id, file.type);
    await uploadPayslip(key, await file.arrayBuffer(), file.type);
    const [updated] = await db
      .update(salaryArchives)
      .set({ payslipKey: key })
      .where(eq(salaryArchives.id, row.id))
      .returning();
    return c.json(updated, 201);
  }

  return c.json(row, 201);
});

// GET /:id/payslip — download the payslip file
app.get('/:id/payslip', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(salaryArchives)
    .where(and(eq(salaryArchives.id, id), eq(salaryArchives.userId, userId)));

  if (!row?.payslipKey) return c.json({ error: 'Not found' }, 404);

  const result = await getPayslip(row.payslipKey);
  if (!result) return c.json({ error: 'File not found' }, 404);

  const ext = row.payslipKey.split('.').pop() ?? 'pdf';
  const filename = `fiche-de-paie-${row.month}.${ext}`;

  return new Response(result.body, {
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'private, max-age=86400',
    },
  });
});

// PUT /:id — update an archive
app.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.accountId !== undefined) setData.accountId = body.accountId;
    const [row] = await db.update(salaryArchives)
      .set(setData)
      .where(and(eq(salaryArchives.id, id), eq(salaryArchives.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Not found' }, 404);
    return c.json(row);
  }

  const { id: _id, userId: _uid, createdAt: _ca, ...data } = body;
  const [row] = await db.update(salaryArchives)
    .set(data)
    .where(and(eq(salaryArchives.id, id), eq(salaryArchives.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Not found' }, 404);
  return c.json(row);
});

// DELETE /:id — delete an archive
app.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(salaryArchives)
    .where(and(eq(salaryArchives.id, id), eq(salaryArchives.userId, userId)));

  if (!row) return c.json({ error: 'Not found' }, 404);

  if (row.payslipKey) {
    await deletePayslip(row.payslipKey);
  }

  await db.delete(salaryArchives).where(eq(salaryArchives.id, id));
  return c.json({ ok: true });
});

export default app;
