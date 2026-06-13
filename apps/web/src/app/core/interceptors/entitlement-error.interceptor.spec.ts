import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { Toaster } from '@shared/components/toast/toast';
import { entitlementErrorInterceptor } from './entitlement-error.interceptor';

describe('entitlementErrorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  const toaster = { error: vi.fn(), info: vi.fn(), success: vi.fn() };
  const router = { navigate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([entitlementErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: Toaster, useValue: toaster },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  async function expectRejected(promise: Promise<unknown>): Promise<void> {
    await expect(promise).rejects.toBeTruthy();
  }

  it('402 LIMIT_REACHED → toast error paramétré par limit + navigation /upgrade', async () => {
    const promise = firstValueFrom(http.get('/budget/accounts'));
    httpMock
      .expectOne('/budget/accounts')
      .flush(
        { code: 'LIMIT_REACHED', limit: 'bankAccounts', max: 2 },
        { status: 402, statusText: 'Payment Required' },
      );

    await expectRejected(promise);

    expect(toaster.error).toHaveBeenCalledWith('entitlement.limit.bankAccounts');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('403 → silencieux : ni toast ni navigation (verrouillage doux), erreur re-propagée', async () => {
    const promise = firstValueFrom(http.get('/medical/patients'));
    httpMock
      .expectOne('/medical/patients')
      .flush({ message: 'forbidden' }, { status: 403, statusText: 'Forbidden' });

    await expectRejected(promise);

    expect(toaster.info).not.toHaveBeenCalled();
    expect(toaster.error).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('402 sans code LIMIT_REACHED → ni toast ni navigation, erreur re-propagée', async () => {
    const promise = firstValueFrom(http.get('/budget/x'));
    httpMock
      .expectOne('/budget/x')
      .flush({ message: 'other' }, { status: 402, statusText: 'Payment Required' });

    await expectRejected(promise);

    expect(toaster.error).not.toHaveBeenCalled();
    expect(toaster.info).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('500 → erreur re-propagée sans toast ni navigation', async () => {
    const promise = firstValueFrom(http.get('/budget/x'));
    httpMock
      .expectOne('/budget/x')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    await expectRejected(promise);

    expect(toaster.error).not.toHaveBeenCalled();
    expect(toaster.info).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('404 → erreur re-propagée sans toast ni navigation', async () => {
    const promise = firstValueFrom(http.get('/budget/x'));
    httpMock
      .expectOne('/budget/x')
      .flush({ message: 'nope' }, { status: 404, statusText: 'Not Found' });

    await expectRejected(promise);

    expect(toaster.error).not.toHaveBeenCalled();
    expect(toaster.info).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('une requête réussie passe sans toucher Toaster ni Router', async () => {
    const promise = firstValueFrom(http.get('/budget/ok'));
    httpMock.expectOne('/budget/ok').flush({ ok: true });

    await expect(promise).resolves.toEqual({ ok: true });
    expect(toaster.error).not.toHaveBeenCalled();
    expect(toaster.info).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
