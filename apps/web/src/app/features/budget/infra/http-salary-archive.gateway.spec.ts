import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { HttpSalaryArchiveGateway } from './http-salary-archive.gateway';
import { CryptoStore } from '@core/services/crypto/crypto.store';

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
