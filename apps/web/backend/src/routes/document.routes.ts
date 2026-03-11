import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { documents } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createDocumentSchema, createEncryptedDocumentSchema } from '../validation.js';
import {
  documentKey,
  uploadDocument,
  getDocument,
  deleteDocument,
} from '../storage/s3.js';

const documentRoutes = new Hono<AppEnv>();

function withFileUrl<T extends { id: string; fileUrl: string | null }>(row: T): T {
  if (!row.fileUrl) return row;
  return { ...row, fileUrl: `/api/documents/${row.id}/file` };
}

// GET all
documentRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(documents).where(eq(documents.userId, userId)).limit(200);
  return c.json(rows.map(withFileUrl));
});

// GET by patient
documentRoutes.get('/by-patient/:patientId', async (c) => {
  const userId = c.get('userId') as string;
  const patientId = c.req.param('patientId');
  const rows = await db.select().from(documents)
    .where(and(eq(documents.patientId, patientId), eq(documents.userId, userId)))
    .limit(200);
  return c.json(rows.map(withFileUrl));
});

// GET by id
documentRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(withFileUrl(row));
});

// GET file (proxy S3)
documentRoutes.get('/:id/file', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!row?.fileUrl) return c.json({ error: 'Aucun fichier' }, 404);

  const file = await getDocument(row.fileUrl);
  if (!file) return c.json({ error: 'Fichier introuvable' }, 404);

  c.header('Content-Type', file.contentType);
  c.header('Cache-Control', 'private, max-age=86400');
  return c.body(file.body);
});

// POST create
documentRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedDocumentSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(documents).values({
      userId,
      patientId: v.data.patientId,
      practitionerId: v.data.practitionerId ?? null,
      type: 'autre',
      title: '',
      date: '1970-01-01',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(withFileUrl(row), 201);
  }

  const v = validate(createDocumentSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(documents).values({
    userId,
    patientId: v.data.patientId,
    practitionerId: v.data.practitionerId ?? null,
    type: v.data.type,
    title: v.data.title,
    date: v.data.date,
    notes: v.data.notes ?? null,
  }).returning();
  return c.json(withFileUrl(row), 201);
});

// POST upload file
documentRoutes.post('/:id/file', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'Fichier manquant' }, 400);

  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return c.json({ error: 'Type de fichier non supporte (PDF, JPG, PNG, WEBP)' }, 400);
  }
  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, 400);
  }

  if (row.fileUrl) {
    await deleteDocument(row.fileUrl);
  }

  const key = documentKey(userId, id, file.type);
  const buffer = await file.arrayBuffer();
  await uploadDocument(key, buffer, file.type);

  const [updated] = await db.update(documents)
    .set({ fileUrl: key })
    .where(eq(documents.id, id))
    .returning();
  return c.json(withFileUrl(updated));
});

// PUT update
documentRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.patientId !== undefined) setData.patientId = body.patientId;
    if (body.practitionerId !== undefined) setData.practitionerId = body.practitionerId ?? null;
    const [row] = await db.update(documents)
      .set(setData)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(withFileUrl(row));
  }

  const [row] = await db.update(documents)
    .set({
      patientId: body.patientId,
      practitionerId: body.practitionerId ?? null,
      type: body.type,
      title: body.title,
      date: body.date,
      notes: body.notes ?? null,
    })
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(withFileUrl(row));
});

// DELETE file
documentRoutes.delete('/:id/file', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);

  if (row.fileUrl) {
    await deleteDocument(row.fileUrl);
    await db.update(documents)
      .set({ fileUrl: null })
      .where(eq(documents.id, id));
  }
  return c.body(null, 204);
});

// DELETE
documentRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db.select().from(documents)
    .where(and(eq(documents.id, id), eq(documents.userId, userId)))
    .limit(1);
  if (row?.fileUrl) {
    await deleteDocument(row.fileUrl);
  }

  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
  return c.body(null, 204);
});

export default documentRoutes;
