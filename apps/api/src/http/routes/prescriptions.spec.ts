import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  multipartInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import type { UploadPolicy } from '../../common/files/upload-policy';
import type { PrescriptionsService } from '../../modules/prescriptions/prescriptions.service';
import type { StorageService } from '../../storage/storage.service';

// Couverture HTTP multipart de POST /prescriptions/:id/document. Champ attendu : `document`.
// Le fichier doit être parsé → storage.upload appelé → svc.update({ documentUrl }).

const PRESC_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DOCUMENT_KEY = `prescriptions/${TEST_USER.id}/presc-1.pdf`;

function mocks() {
  const svc = {
    list: vi.fn(),
    getOne: vi.fn().mockResolvedValue({ id: PRESC_ID }),
    create: vi.fn(),
    update: vi
      .fn()
      .mockResolvedValue({ id: PRESC_ID, documentUrl: DOCUMENT_KEY }),
    remove: vi.fn(),
    byAppointment: vi.fn(),
  };
  const storage = {
    prescriptionKey: vi.fn(() => DOCUMENT_KEY),
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
    prescriptions: m.svc as unknown as PrescriptionsService,
    storage: m.storage as unknown as StorageService,
    uploadPolicy: m.uploads as unknown as UploadPolicy,
  });
  return { ...m, t };
}

describe('Routes /prescriptions — POST /prescriptions/:id/document (multipart, Hono)', () => {
  it("champ 'document' → 201, storage.upload appelé, svc.update reçoit { documentUrl }", async () => {
    const { t, svc, storage } = await setup();

    const res = await t.authed(
      `/prescriptions/${PRESC_ID}/document`,
      multipartInit('document', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(201);
    expect(svc.getOne).toHaveBeenCalledWith(TEST_USER.id, PRESC_ID);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(svc.update).toHaveBeenCalledWith(
      TEST_USER.id,
      PRESC_ID,
      expect.objectContaining({ documentUrl: expect.any(String) }),
    );
  });

  it('sans fichier → 400 (« Fichier requis »), storage.upload jamais appelé', async () => {
    const { t, storage } = await setup();

    const res = await t.authed(`/prescriptions/${PRESC_ID}/document`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Fichier requis' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('prescription inexistante → 404, storage.upload jamais appelé', async () => {
    const { t, svc, storage } = await setup();
    svc.getOne.mockResolvedValueOnce(undefined);

    const res = await t.authed(
      `/prescriptions/${PRESC_ID}/document`,
      multipartInit('document', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });
});
