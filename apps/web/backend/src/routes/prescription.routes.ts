import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '@db/client';
import { prescriptions } from '@db/schema';
import type { AppEnv } from '../types.js';
import { validate, createPrescriptionSchema, createEncryptedPrescriptionSchema } from '../validation.js';
import {
  prescriptionKey,
  uploadPrescriptionDoc,
  getPrescriptionDoc,
  deletePrescriptionDoc,
} from '../storage/s3.js';

const prescriptionRoutes = new Hono<AppEnv>();

// Transform S3 key into backend-proxied URL
function withDocUrl<T extends { id: string; documentUrl: string | null }>(row: T): T {
  if (!row.documentUrl) return row;
  return { ...row, documentUrl: `/api/prescriptions/${row.id}/document` };
}

// GET all
prescriptionRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const rows = await db.select().from(prescriptions).where(eq(prescriptions.userId, userId)).limit(100);
  return c.json(rows.map(withDocUrl));
});

// GET by appointment id
prescriptionRoutes.get('/by-appointment/:appointmentId', async (c) => {
  const userId = c.get('userId') as string;
  const appointmentId = c.req.param('appointmentId');
  const rows = await db.select().from(prescriptions)
    .where(and(eq(prescriptions.appointmentId, appointmentId), eq(prescriptions.userId, userId)))
    .limit(100);
  return c.json(rows.map(withDocUrl));
});

// GET by id
prescriptionRoutes.get('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(prescriptions)
    .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(withDocUrl(row));
});

// GET document file
prescriptionRoutes.get('/:id/document', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(prescriptions)
    .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
    .limit(1);
  if (!row?.documentUrl) return c.json({ error: 'Aucun document' }, 404);

  const file = await getPrescriptionDoc(row.documentUrl);
  if (!file) return c.json({ error: 'Fichier introuvable' }, 404);

  c.header('Content-Type', file.contentType);
  c.header('Cache-Control', 'private, max-age=86400');
  return c.body(file.body);
});

// POST create
prescriptionRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();

  if (body.encryptedData) {
    const v = validate(createEncryptedPrescriptionSchema, body);
    if (!v.success) return c.json({ error: v.error }, 400);
    const [row] = await db.insert(prescriptions).values({
      userId,
      appointmentId: v.data.appointmentId ?? null,
      practitionerId: v.data.practitionerId ?? null,
      patientId: v.data.patientId,
      issuedDate: '1970-01-01',
      encryptedData: v.data.encryptedData,
    }).returning();
    return c.json(withDocUrl(row), 201);
  }

  const v = validate(createPrescriptionSchema, body);
  if (!v.success) return c.json({ error: v.error }, 400);
  const [row] = await db.insert(prescriptions).values({
    userId,
    appointmentId: v.data.appointmentId ?? null,
    practitionerId: v.data.practitionerId ?? null,
    patientId: v.data.patientId,
    issuedDate: v.data.issuedDate,
    validUntil: v.data.validUntil ?? null,
    notes: v.data.notes ?? null,
  }).returning();
  return c.json(withDocUrl(row), 201);
});

// POST upload document
prescriptionRoutes.post('/:id/document', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  const [row] = await db.select().from(prescriptions)
    .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
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

  // Delete old document if exists
  if (row.documentUrl) {
    await deletePrescriptionDoc(row.documentUrl);
  }

  const key = prescriptionKey(userId, id, file.type);
  const buffer = await file.arrayBuffer();
  await uploadPrescriptionDoc(key, buffer, file.type);

  const [updated] = await db.update(prescriptions)
    .set({ documentUrl: key })
    .where(eq(prescriptions.id, id))
    .returning();
  return c.json(withDocUrl(updated));
});

// PUT update
prescriptionRoutes.put('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const body = await c.req.json();

  if (body.encryptedData) {
    const setData: Record<string, unknown> = { encryptedData: body.encryptedData };
    if (body.appointmentId !== undefined) setData.appointmentId = body.appointmentId ?? null;
    if (body.practitionerId !== undefined) setData.practitionerId = body.practitionerId ?? null;
    if (body.patientId !== undefined) setData.patientId = body.patientId;
    const [row] = await db.update(prescriptions)
      .set(setData)
      .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
      .returning();
    if (!row) return c.json({ error: 'Non trouve' }, 404);
    return c.json(withDocUrl(row));
  }

  const [row] = await db.update(prescriptions)
    .set({
      appointmentId: body.appointmentId ?? null,
      practitionerId: body.practitionerId ?? null,
      patientId: body.patientId,
      issuedDate: body.issuedDate,
      validUntil: body.validUntil ?? null,
      notes: body.notes ?? null,
    })
    .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
    .returning();
  if (!row) return c.json({ error: 'Non trouve' }, 404);
  return c.json(withDocUrl(row));
});

// DELETE document
prescriptionRoutes.delete('/:id/document', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');
  const [row] = await db.select().from(prescriptions)
    .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
    .limit(1);
  if (!row) return c.json({ error: 'Non trouve' }, 404);

  if (row.documentUrl) {
    await deletePrescriptionDoc(row.documentUrl);
    await db.update(prescriptions)
      .set({ documentUrl: null })
      .where(eq(prescriptions.id, id));
  }
  return c.body(null, 204);
});

// DELETE
prescriptionRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const id = c.req.param('id');

  // Clean up document from S3
  const [row] = await db.select().from(prescriptions)
    .where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)))
    .limit(1);
  if (row?.documentUrl) {
    await deletePrescriptionDoc(row.documentUrl);
  }

  await db.delete(prescriptions).where(and(eq(prescriptions.id, id), eq(prescriptions.userId, userId)));
  return c.body(null, 204);
});

export default prescriptionRoutes;
