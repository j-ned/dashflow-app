import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';
import type { Env } from '../config/env.schema';

const cfg = (configured: boolean) => {
  const configuredValues: Record<string, string> = {
    S3_ENDPOINT: 'https://x.r2.cloudflarestorage.com',
    S3_REGION: 'auto',
    S3_ACCESS_KEY_ID: 'a',
    S3_SECRET_ACCESS_KEY: 'b',
    S3_BUCKET: 'dashflow-app',
  };
  const unconfiguredValues: Record<string, string> = { S3_REGION: 'auto' };
  return {
    get: (k: string) => (configured ? configuredValues : unconfiguredValues)[k],
  } as unknown as ConfigService<Env, true>;
};

describe('StorageService key builders', () => {
  const svc = new StorageService(cfg(true));
  it('avatarKey png', () => {
    expect(svc.avatarKey('u1', 'image/png')).toBe('avatars/u1.png');
  });
  it('avatarKey jpeg→jpg', () => {
    expect(svc.avatarKey('u1', 'image/jpeg')).toBe('avatars/u1.jpg');
  });
  it('prescriptionKey', () => {
    expect(svc.prescriptionKey('u1', 'p1', 'application/pdf')).toBe(
      'prescriptions/u1/p1.pdf',
    );
  });
  it('documentKey', () => {
    expect(svc.documentKey('u1', 'd1', 'application/pdf')).toBe(
      'documents/u1/d1.pdf',
    );
  });
  it('payslipKey', () => {
    expect(svc.payslipKey('u1', 'e1', 'application/pdf')).toBe(
      'payslips/u1/e1.pdf',
    );
  });
});

describe('StorageService non configuré', () => {
  it('upload lance si pas de client', async () => {
    const svc = new StorageService(cfg(false));
    await expect(
      svc.upload('k', Buffer.from('x'), 'text/plain'),
    ).rejects.toThrow();
  });
  it('delete ne lance pas si pas de client', async () => {
    const svc = new StorageService(cfg(false));
    await expect(svc.delete('k')).resolves.toBeUndefined();
  });
});

// deletePrefix — suppression par préfixe (RGPD)
describe('StorageService.deletePrefix', () => {
  type WithDeletePrefix = StorageService & {
    deletePrefix(prefix: string): Promise<void>;
  };
  type S3Command = {
    constructor: { name: string };
    input: Record<string, unknown>;
  };

  it('liste sous le bon Prefix/Bucket (paginé via ContinuationToken) puis supprime les clés trouvées', async () => {
    const svc = new StorageService(cfg(true)) as WithDeletePrefix;
    const send = vi.fn((cmd: S3Command) => {
      if (cmd.constructor.name === 'ListObjectsV2Command') {
        return cmd.input.ContinuationToken
          ? Promise.resolve({
              Contents: [{ Key: 'documents/u1/b.pdf' }],
              IsTruncated: false,
            })
          : Promise.resolve({
              Contents: [{ Key: 'documents/u1/a.pdf' }],
              IsTruncated: true,
              NextContinuationToken: 'tok1',
            });
      }
      return Promise.resolve({});
    });
    (svc as unknown as { client: { send: typeof send } }).client.send = send;

    await svc.deletePrefix('documents/u1/');

    const cmds = send.mock.calls.map((c) => c[0]);
    const lists = cmds.filter(
      (c) => c.constructor.name === 'ListObjectsV2Command',
    );
    const deletes = cmds.filter(
      (c) => c.constructor.name === 'DeleteObjectsCommand',
    );
    expect(lists.length).toBeGreaterThanOrEqual(2);
    expect(lists[0].input.Prefix).toBe('documents/u1/');
    expect(lists[0].input.Bucket).toBe('dashflow-app');
    expect(lists[1].input.ContinuationToken).toBe('tok1');
    const deletedKeys = deletes.flatMap((d) =>
      (d.input.Delete as { Objects: { Key: string }[] }).Objects.map(
        (o) => o.Key,
      ),
    );
    expect(deletedKeys).toEqual(
      expect.arrayContaining(['documents/u1/a.pdf', 'documents/u1/b.pdf']),
    );
  });

  it('no-op si client/bucket non configuré (aucun send émis, pas d’erreur)', async () => {
    const svc = new StorageService(cfg(false)) as WithDeletePrefix;
    await expect(svc.deletePrefix('documents/u1/')).resolves.toBeUndefined();
  });
});
