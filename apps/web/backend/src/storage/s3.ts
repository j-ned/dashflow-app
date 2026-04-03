import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'garage',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const AVATAR_BUCKET = process.env['S3_BUCKET_AVATAR'] ?? 'dashflow-avatars';

export function avatarKey(userId: string, contentType: string): string {
  const ext = contentType.split('/')[1] ?? 'jpg';
  return `avatars/${userId}.${ext}`;
}

export async function uploadAvatar(key: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: AVATAR_BUCKET,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }),
  );
}

export async function getAvatar(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: AVATAR_BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? 'image/jpeg',
    };
  } catch {
    return null;
  }
}

export async function deleteAvatar(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: AVATAR_BUCKET, Key: key }));
  } catch {
    // Non-critical
  }
}

// ── Prescriptions documents ──

const ORDO_BUCKET = process.env['S3_BUCKET_ORDO'] ?? 'dashflow-ordonnances';

export function prescriptionKey(userId: string, prescriptionId: string, contentType: string): string {
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'pdf';
  return `prescriptions/${userId}/${prescriptionId}.${ext}`;
}

export function prescriptionDocUrl(key: string): string {
  const endpoint = process.env['S3_ENDPOINT']!;
  return `${endpoint}/${ORDO_BUCKET}/${key}`;
}

export async function uploadPrescriptionDoc(key: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: ORDO_BUCKET,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      CacheControl: 'private, max-age=86400',
    }),
  );
}

export async function getPrescriptionDoc(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: ORDO_BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? 'application/pdf',
    };
  } catch {
    return null;
  }
}

export async function deletePrescriptionDoc(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: ORDO_BUCKET, Key: key }));
  } catch {
    // Non-critical
  }
}

// ── Medical documents (comptes rendus, factures, bilans…) ──

export function documentKey(userId: string, documentId: string, contentType: string): string {
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'pdf';
  return `documents/${userId}/${documentId}.${ext}`;
}

export async function uploadDocument(key: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: ORDO_BUCKET,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      CacheControl: 'private, max-age=86400',
    }),
  );
}

export async function getDocument(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: ORDO_BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? 'application/pdf',
    };
  } catch {
    return null;
  }
}

export async function deleteDocument(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: ORDO_BUCKET, Key: key }));
  } catch {
    // Non-critical
  }
}

// ── Salary payslips (fiches de paie — revenus) ──

const SALAIRE_BUCKET = process.env['S3_BUCKET_SALAIRE'] ?? 'dashflow-salaire';

export function salaryPayslipKey(userId: string, entryId: string, contentType: string): string {
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'pdf';
  return `payslips/${userId}/${entryId}.${ext}`;
}

export async function uploadSalaryPayslip(key: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: SALAIRE_BUCKET,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      CacheControl: 'private, max-age=86400',
    }),
  );
}

export async function getSalaryPayslip(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: SALAIRE_BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? 'application/pdf',
    };
  } catch {
    return null;
  }
}

export async function deleteSalaryPayslip(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: SALAIRE_BUCKET, Key: key }));
  } catch {
    // Non-critical
  }
}

// ── Payslips (fiches de paie — archives) ──

export function payslipKey(userId: string, archiveId: string, contentType: string): string {
  const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'pdf';
  return `payslips/${userId}/${archiveId}.${ext}`;
}

export async function uploadPayslip(key: string, buffer: ArrayBuffer, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: SALAIRE_BUCKET,
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
      CacheControl: 'private, max-age=86400',
    }),
  );
}

export async function getPayslip(key: string): Promise<{ body: ReadableStream; contentType: string } | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: SALAIRE_BUCKET, Key: key }));
    if (!res.Body) return null;
    return {
      body: res.Body.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? 'application/pdf',
    };
  } catch {
    return null;
  }
}

export async function deletePayslip(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: SALAIRE_BUCKET, Key: key }));
  } catch {
    // Non-critical
  }
}
