import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

function ext(contentType: string, fallback: string): string {
  return (contentType.split('/')[1] ?? fallback).replace('jpeg', 'jpg');
}

@Injectable()
export class StorageService {
  private readonly client: S3Client | null;
  private readonly bucket: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    const endpoint = config.get('S3_ENDPOINT', { infer: true });
    const accessKeyId = config.get('S3_ACCESS_KEY_ID', { infer: true });
    const secretAccessKey = config.get('S3_SECRET_ACCESS_KEY', { infer: true });
    this.bucket = config.get('S3_BUCKET', { infer: true });
    this.client =
      endpoint && accessKeyId && secretAccessKey && this.bucket
        ? new S3Client({
            region: config.get('S3_REGION', { infer: true }),
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: true,
          })
        : null;
  }

  private ready(): { client: S3Client; bucket: string } {
    if (!this.client || !this.bucket)
      throw new ServiceUnavailableException('Stockage R2 non configuré');
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
