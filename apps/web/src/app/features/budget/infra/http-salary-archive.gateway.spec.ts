import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HttpSalaryArchiveGateway } from './http-salary-archive.gateway';
import { CryptoStore, decryptWithKey } from '@core/services/crypto/crypto.store';
import { encryptEntity } from '@core/services/crypto/entity-crypto';
import { SalaryArchive } from '../domain/models/salary-archive.model';

const BASE = environment.apiUrl;

async function waitForRequest(httpMock: HttpTestingController, url: string, tries = 50) {
  for (let i = 0; i < tries; i++) {
    const reqs = httpMock.match(url);
    if (reqs.length === 1) return reqs[0];
    if (reqs.length > 1) throw new Error(`multiple requests for ${url}`);
    await new Promise((r) => setTimeout(r, 0));
  }
  throw new Error(`no request emitted for ${url}`);
}

describe('HttpSalaryArchiveGateway (compte démo, données en clair)', () => {
  let gateway: HttpSalaryArchiveGateway;
  let httpController: HttpTestingController;

  const mockCryptoStore = { getMasterKey: () => null };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpSalaryArchiveGateway,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CryptoStore, useValue: mockCryptoStore },
      ],
    });
    gateway = TestBed.inject(HttpSalaryArchiveGateway);
    httpController = TestBed.inject(HttpTestingController);
  });

  const CLEARTEXT_API_ARCHIVE = {
    id: 'sa-1',
    accountId: 'acc-1',
    month: '2026-06',
    salary: '2100.00',
    totalExpenses: '200.00',
    totalSpendings: '50.00',
    spendings: [{ label: 'Courses', amount: '12.50', date: '2026-06-10', category: 'food' }],
    payslipKey: null,
  };

  it('getAll() garde une archive dont les numeric reviennent en string (pas exclue par validateList)', async () => {
    const promise = firstValueFrom(gateway.getAll());
    httpController
      .expectOne({ method: 'GET', url: `${environment.apiUrl}/salary-archives` })
      .flush([CLEARTEXT_API_ARCHIVE]);
    httpController.verify();

    const result = await promise;
    expect(result).toHaveLength(1);
  });

  it('getAll() coerce salary string→number pour une archive en clair', async () => {
    const promise = firstValueFrom(gateway.getAll());
    httpController
      .expectOne({ method: 'GET', url: `${environment.apiUrl}/salary-archives` })
      .flush([CLEARTEXT_API_ARCHIVE]);
    httpController.verify();

    const result = await promise;
    expect(result[0].salary).toBe(2100);
    expect(typeof result[0].salary).toBe('number');
  });
});

describe('HttpSalaryArchiveGateway (compte chiffré, E2EE) — create()', () => {
  let gateway: HttpSalaryArchiveGateway;
  let httpController: HttpTestingController;
  let key: CryptoKey;

  const CLEARTEXT_KEYS = ['id', 'userId', 'accountId', 'createdAt'] as const;

  const ARCHIVE: SalaryArchive = {
    id: 'sa-1',
    accountId: 'acc-1',
    month: '2026-06',
    salary: 2100,
    totalExpenses: 200,
    totalSpendings: 50,
    spendings: [{ label: 'Courses', amount: 12.5, date: '2026-06-10', category: 'food' }],
    payslipKey: null,
  };

  beforeAll(async () => {
    key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
      'encrypt',
      'decrypt',
    ]);
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        HttpSalaryArchiveGateway,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CryptoStore, useValue: { getMasterKey: () => key } },
      ],
    });
    gateway = TestBed.inject(HttpSalaryArchiveGateway);
    httpController = TestBed.inject(HttpTestingController);
  });

  function buildFormData(withPayslip: boolean): FormData {
    const fd = new FormData();
    fd.append('month', ARCHIVE.month);
    fd.append('salary', String(ARCHIVE.salary));
    fd.append('totalExpenses', String(ARCHIVE.totalExpenses));
    fd.append('totalSpendings', String(ARCHIVE.totalSpendings));
    fd.append('spendings', JSON.stringify(ARCHIVE.spendings));
    fd.append('accountId', ARCHIVE.accountId!);
    if (withPayslip) {
      const payslip = new File(['%PDF-1.4 fake bulletin'], 'bulletin.pdf', {
        type: 'application/pdf',
      });
      fd.append('payslip', payslip);
    }
    return fd;
  }

  it('joint la fiche de paie chiffrée sous le champ `payslip` (jamais sous `file`)', async () => {
    const promise = firstValueFrom(gateway.create(buildFormData(true)));
    const req = await waitForRequest(httpController, `${BASE}/salary-archives`);

    const row = await encryptEntity(ARCHIVE as Record<string, unknown>, CLEARTEXT_KEYS, key);
    req.flush(row);
    httpController.verify();
    await promise;

    const body = req.request.body as FormData;
    expect(body.get('payslip')).toBeInstanceOf(File);
    expect(body.get('file')).toBeNull();
  });

  it('ne chiffre pas le File `payslip` comme donnée JSON (absent de encryptedData)', async () => {
    const promise = firstValueFrom(gateway.create(buildFormData(true)));
    const req = await waitForRequest(httpController, `${BASE}/salary-archives`);

    const row = await encryptEntity(ARCHIVE as Record<string, unknown>, CLEARTEXT_KEYS, key);
    req.flush(row);
    httpController.verify();
    await promise;

    const body = req.request.body as FormData;
    const encryptedData = body.get('encryptedData') as string;
    const sensitive = JSON.parse(await decryptWithKey(encryptedData, key));
    expect(sensitive).not.toHaveProperty('payslip');
  });

  it('sans fiche de paie : POST avec encryptedData + clés claires, aucun champ fichier', async () => {
    const promise = firstValueFrom(gateway.create(buildFormData(false)));
    const req = await waitForRequest(httpController, `${BASE}/salary-archives`);

    const row = await encryptEntity(ARCHIVE as Record<string, unknown>, CLEARTEXT_KEYS, key);
    req.flush(row);
    httpController.verify();
    await promise;

    const body = req.request.body as FormData;
    expect(body.get('encryptedData')).toBeTypeOf('string');
    expect(body.get('accountId')).toBe('acc-1');
    expect(body.get('payslip')).toBeNull();
    expect(body.get('file')).toBeNull();
  });
});
