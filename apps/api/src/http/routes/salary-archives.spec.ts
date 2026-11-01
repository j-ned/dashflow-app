import { describe, it, expect, vi } from 'vitest';
import {
  honoTestApp,
  multipartInit,
  TEST_USER,
} from '../../../test/support/hono-test-app';
import type { UploadPolicy } from '../../common/files/upload-policy';
import type { SalaryArchivesService } from '../../modules/salary-archives/salary-archives.service';
import type { StorageService } from '../../storage/storage.service';

// Le front poste TOUJOURS l'archive en multipart/form-data (postForm) : les champs texte font
// office de corps, la fiche de paie (`payslip`) est facultative.

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const ARCHIVE_ID = 'arch-1';
const PAYSLIP_KEY = `payslips/${TEST_USER.id}/arch-1.pdf`;

const SPENDINGS = [
  { label: 'x', amount: 50, date: '2026-06-10', category: 'c' },
];

const CLEAR_FIELDS = {
  month: '2026-06',
  salary: '1500',
  totalExpenses: '200',
  totalSpendings: '50',
  spendings: JSON.stringify(SPENDINGS),
};

/** Corps multipart sans fichier : seulement des champs texte. */
function fieldsInit(fields: Record<string, string>): RequestInit {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return { method: 'POST', body: form };
}

function mocks() {
  const svc = {
    list: vi.fn(),
    getOne: vi.fn(),
    create: vi.fn().mockResolvedValue({ id: ARCHIVE_ID }),
    update: vi
      .fn()
      .mockResolvedValue({ id: ARCHIVE_ID, payslipKey: PAYSLIP_KEY }),
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
    salaryArchives: m.svc as unknown as SalaryArchivesService,
    storage: m.storage as unknown as StorageService,
    uploadPolicy: m.uploads as unknown as UploadPolicy,
  });
  return { ...m, t };
}

describe('Routes /salary-archives — POST /salary-archives (multipart, Hono)', () => {
  it('mode clair (sans fichier) → 201 et svc.create reçoit month + spendings en ARRAY', async () => {
    const { t, svc, storage } = await setup();

    const res = await t.authed('/salary-archives', fieldsInit(CLEAR_FIELDS));

    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalledWith(
      TEST_USER.id,
      expect.objectContaining({
        month: '2026-06',
        salary: '1500.00',
        spendings: SPENDINGS,
      }),
    );
    const passed = svc.create.mock.calls[0]?.[1] as { spendings: unknown };
    expect(Array.isArray(passed.spendings)).toBe(true);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it('mode chiffré (encryptedData) → 201 et svc.create reçoit month/salary placeholders', async () => {
    const { t, svc } = await setup();

    const res = await t.authed(
      '/salary-archives',
      fieldsInit({ encryptedData: 'blob123', accountId: ACCOUNT_ID }),
    );

    expect(res.status).toBe(201);
    expect(svc.create).toHaveBeenCalledWith(
      TEST_USER.id,
      expect.objectContaining({
        encryptedData: 'blob123',
        month: '0000-00',
        salary: '0',
      }),
    );
  });

  it('payslip optionnel → storage.upload appelé, svc.update reçoit { payslipKey }, 201', async () => {
    const { t, svc, storage, uploads } = await setup();

    const res = await t.authed(
      '/salary-archives',
      multipartInit(
        'payslip',
        Buffer.from('%PDF-1.4'),
        'application/pdf',
        CLEAR_FIELDS,
      ),
    );

    expect(res.status).toBe(201);
    expect(uploads.assertValid).toHaveBeenCalledTimes(1);
    expect(svc.create).toHaveBeenCalledTimes(1);
    expect(storage.upload).toHaveBeenCalledTimes(1);
    expect(svc.update).toHaveBeenCalledWith(
      TEST_USER.id,
      ARCHIVE_ID,
      expect.objectContaining({ payslipKey: expect.any(String) }),
    );
  });
});

// Non-régression : la garde CSRF doit rester active sur le create surchargé.
describe('Routes /salary-archives — POST /salary-archives garde CSRF active (Hono)', () => {
  it('jeton CSRF refusé → 403, svc.create jamais appelé', async () => {
    const { t, svc } = await setup();

    const res = await t.authed('/salary-archives', {
      ...fieldsInit({ month: '2026-06', salary: '1500' }),
      headers: { 'X-CSRF-Token': 'faux' },
    });

    expect(res.status).toBe(403);
    expect(svc.create).not.toHaveBeenCalled();
  });
});
