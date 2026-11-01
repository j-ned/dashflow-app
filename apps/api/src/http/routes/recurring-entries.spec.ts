import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  jsonInit,
  multipartInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import type { UploadPolicy } from '../../common/files/upload-policy';
import type { RecurringEntriesService } from '../../modules/recurring-entries/recurring-entries.service';
import type { StorageService } from '../../storage/storage.service';

const ENTRY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TO_ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const PAYSLIP_KEY = `payslips/${TEST_USER.id}/entry-1.pdf`;

function mocks() {
  const svc = {
    list: vi.fn(),
    getOne: vi.fn().mockResolvedValue({ id: ENTRY_ID }),
    create: vi
      .fn()
      .mockImplementation((_u: string, v: object) =>
        Promise.resolve({ id: ENTRY_ID, ...v }),
      ),
    update: vi
      .fn()
      .mockResolvedValue({ id: ENTRY_ID, payslipKey: PAYSLIP_KEY }),
    remove: vi.fn(),
  };
  const storage = {
    payslipKey: vi.fn(() => PAYSLIP_KEY),
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
    recurringEntries: m.svc as unknown as RecurringEntriesService,
    storage: m.storage as unknown as StorageService,
    uploadPolicy: m.uploads as unknown as UploadPolicy,
  });
  return { ...m, t };
}

// Transformations du corps chiffré, vérifiées par HTTP : ce que le service reçoit.
describe('Routes /recurring-entries — transferts chiffrés (E2EE, Hono)', () => {
  describe('POST / — branche chiffrée', () => {
    it('Given un virement chiffré avec toAccountId, When create, Then toAccountId est conservé', async () => {
      const { t, svc } = await setup();

      const res = await t.authed(
        '/recurring-entries',
        jsonInit('POST', { encryptedData: 'blob', toAccountId: TO_ACCOUNT_ID }),
      );

      // Régression : sans toAccountId, le compte destination n'est jamais crédité.
      expect(res.status).toBe(201);
      expect(svc.create).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({ toAccountId: TO_ACCOUNT_ID }),
      );
    });

    it('Given un virement chiffré sans toAccountId, When create, Then toAccountId vaut null', async () => {
      const { t, svc } = await setup();

      const res = await t.authed(
        '/recurring-entries',
        jsonInit('POST', { encryptedData: 'blob' }),
      );

      expect(res.status).toBe(201);
      expect(svc.create).toHaveBeenCalledWith(
        TEST_USER.id,
        expect.objectContaining({ toAccountId: null }),
      );
    });
  });

  describe('PUT /:id — branche chiffrée', () => {
    it('Given une édition chiffrée avec toAccountId, When update, Then toAccountId est propagé', async () => {
      const { t, svc } = await setup();

      const res = await t.authed(
        `/recurring-entries/${ENTRY_ID}`,
        jsonInit('PUT', { encryptedData: 'blob', toAccountId: TO_ACCOUNT_ID }),
      );

      expect(res.status).toBe(200);
      expect(svc.update).toHaveBeenCalledWith(
        TEST_USER.id,
        ENTRY_ID,
        expect.objectContaining({ toAccountId: TO_ACCOUNT_ID }),
      );
    });
  });
});

// Couverture HTTP multipart de POST /recurring-entries/:id/payslip. Champ attendu : `payslip`.
// Le fichier doit être parsé → storage.upload appelé → svc.update({ payslipKey }).
describe('Routes /recurring-entries — POST /recurring-entries/:id/payslip (multipart, Hono)', () => {
  it("champ 'payslip' → 201, storage.upload appelé, svc.update reçoit { payslipKey }", async () => {
    const { t, svc, storage } = await setup();

    const res = await t.authed(
      `/recurring-entries/${ENTRY_ID}/payslip`,
      multipartInit('payslip', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(201);
    expect(svc.getOne).toHaveBeenCalledWith(TEST_USER.id, ENTRY_ID);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(svc.update).toHaveBeenCalledWith(
      TEST_USER.id,
      ENTRY_ID,
      expect.objectContaining({ payslipKey: expect.any(String) }),
    );
  });

  it('sans fichier → 400 (« Fichier requis »), storage.upload jamais appelé', async () => {
    const { t, storage } = await setup();

    const res = await t.authed(`/recurring-entries/${ENTRY_ID}/payslip`, {
      method: 'POST',
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ message: 'Fichier requis' });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('entrée inexistante → 404, storage.upload jamais appelé', async () => {
    const { t, svc, storage } = await setup();
    svc.getOne.mockResolvedValueOnce(undefined);

    const res = await t.authed(
      `/recurring-entries/${ENTRY_ID}/payslip`,
      multipartInit('payslip', Buffer.from('%PDF-1.4'), 'application/pdf'),
    );

    expect(res.status).toBe(404);
    expect(storage.upload).not.toHaveBeenCalled();
    expect(svc.update).not.toHaveBeenCalled();
  });
});
