import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  multipartInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import { BadRequestError } from '../../common/errors';
import type { UploadPolicy } from '../../common/files/upload-policy';
import type { DocumentsService } from '../../modules/documents/documents.service';
import type { StorageService } from '../../storage/storage.service';

// Couverture HTTP multipart de POST /documents/:id/file. Champ attendu : `file`.
// Le fichier doit être parsé → storage.upload appelé → svc.update({ fileUrl }).

const DOC_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const FILE_KEY = `documents/${TEST_USER.id}/doc-1.pdf`;

function mocks() {
  const svc = {
    list: vi.fn(),
    getOne: vi.fn().mockResolvedValue({ id: DOC_ID }),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue({ id: DOC_ID, fileUrl: FILE_KEY }),
    remove: vi.fn(),
    byPatient: vi.fn(),
  };
  const storage = {
    documentKey: vi.fn(() => FILE_KEY),
    upload: vi.fn().mockResolvedValue(undefined),
    getStream: vi.fn(),
    delete: vi.fn(),
    deletePrefix: vi.fn(),
  };
  // UploadPolicy est simulée : la règle E2EE/clair est couverte par upload-policy.spec.ts.
  const uploads = { assertValid: vi.fn().mockResolvedValue(undefined) };
  return { svc, storage, uploads };
}

async function setup() {
  const m = mocks();
  const t = await honoTestApp({
    documents: m.svc as unknown as DocumentsService,
    storage: m.storage as unknown as StorageService,
    uploadPolicy: m.uploads as unknown as UploadPolicy,
  });
  return { ...m, t };
}

describe('Routes /documents — POST /documents/:id/file (multipart, Hono)', () => {
  it("champ 'file' → 201, storage.upload appelé, svc.update reçoit { fileUrl }", async () => {
    const { t, svc, storage } = await setup();

    const res = await t.authed(
      `/documents/${DOC_ID}/file`,
      multipartInit('file', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(201);
    expect(svc.getOne).toHaveBeenCalledWith(TEST_USER.id, DOC_ID);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(svc.update).toHaveBeenCalledWith(
      TEST_USER.id,
      DOC_ID,
      expect.objectContaining({ fileUrl: expect.any(String) }),
    );
  });

  it('blob opaque (E2EE) accepté par la politique → 201, uploadé tel quel en octet-stream', async () => {
    const { t, uploads, storage } = await setup();

    const res = await t.authed(
      `/documents/${DOC_ID}/file`,
      multipartInit(
        'file',
        Buffer.from([0x9f, 0x12, 0x00, 0xff]),
        'application/octet-stream',
      ),
    );

    expect(res.status).toBe(201);
    expect(uploads.assertValid).toHaveBeenCalledWith(
      TEST_USER.id,
      expect.objectContaining({ mimetype: 'application/octet-stream' }),
    );
    expect(storage.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      'application/octet-stream',
    );
  });

  it("politique d'upload refuse → 400, storage.upload jamais appelé", async () => {
    const { t, uploads, storage, svc } = await setup();
    uploads.assertValid.mockRejectedValueOnce(
      new BadRequestError('Type de fichier non autorisé'),
    );

    const res = await t.authed(
      `/documents/${DOC_ID}/file`,
      multipartInit(
        'file',
        Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
        'application/pdf',
      ),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      message: 'Type de fichier non autorisé',
    });
    expect(storage.upload).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });

  it('sans fichier → 400 (« Fichier requis »), storage.upload jamais appelé', async () => {
    const { t, storage } = await setup();

    const res = await t.authed(`/documents/${DOC_ID}/file`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Fichier requis' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('document inexistant → 404, storage.upload jamais appelé', async () => {
    const { t, svc, storage } = await setup();
    svc.getOne.mockResolvedValueOnce(undefined);

    const res = await t.authed(
      `/documents/${DOC_ID}/file`,
      multipartInit('file', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });
});
