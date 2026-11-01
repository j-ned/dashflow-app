import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';
import type { Env } from '../config/env.schema';
import { ServiceUnavailableError } from '../common/errors';

function ext(contentType: string, fallback: string): string {
  // Fichier chiffré côté client (E2EE) : contenu opaque, extension neutre.
  if (contentType === 'application/octet-stream') return 'bin';
  return (contentType.split('/')[1] ?? fallback).replace('jpeg', 'jpg');
}

export class StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(
    config: Pick<
      Env,
      | 'S3_ACCESS_KEY_ID'
      | 'S3_BUCKET'
      | 'S3_ENDPOINT'
      | 'S3_REGION'
      | 'S3_SECRET_ACCESS_KEY'
    >,
  ) {
    const endpoint = config.S3_ENDPOINT;
    const accessKeyId = config.S3_ACCESS_KEY_ID;
    const secretAccessKey = config.S3_SECRET_ACCESS_KEY;
    this.bucket = config.S3_BUCKET;
    this.client =
      endpoint && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            region: config.S3_REGION,
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
          })
        : null;
  }

  private ready(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket)
      throw new ServiceUnavailableError('Stockage R2 non configuré');
    return { client: this.client, bucket: this.bucket };
  }

  avatarKey(userId: string, ct: string): string {
    return `avatars/${userId}.${ext(ct, 'jpg')}`;
  }
  prescriptionKey(userId: string, id: string, ct: string): string {
    return `prescriptions/${userId}/${id}.${ext(ct, 'pdf')}`;
  }
  documentKey(userId: string, id: string, ct: string): string {
    return `documents/${userId}/${id}.${ext(ct, 'pdf')}`;
  }
  payslipKey(userId: string, id: string, ct: string): string {
    return `payslips/${userId}/${id}.${ext(ct, 'pdf')}`;
  }

  async upload(
    key: string,
    body: Buffer,
    contentType: string,
    cacheControl = 'private, max-age=86400',
  ): Promise<void> {
    const { client, bucket } = this.ready();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: cacheControl,
      }),
    );
  }

  async getStream(
    key: string,
  ): Promise<{ stream: Readable; contentType: string } | null> {
    const { client, bucket } = this.ready();
    try {
      const res = await client.send(
        new GetObjectCommand({ Bucket: bucket, Key: key }),
      );
      if (!res.Body) return null;
      return {
        stream: res.Body as Readable,
        contentType: res.ContentType ?? 'application/octet-stream',
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client || !this.bucket) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch {
      /* non-critique */
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    if (!this.client || !this.bucket) return;
    const client = this.client;
    const bucket = this.bucket;
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ...(continuationToken
            ? { ContinuationToken: continuationToken }
            : {}),
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (obj.Key) keys.push(obj.Key);
      }
      continuationToken = res.IsTruncated
        ? res.NextContinuationToken
        : undefined;
    } while (continuationToken);

    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: batch },
        }),
      );
    }
  }
}
