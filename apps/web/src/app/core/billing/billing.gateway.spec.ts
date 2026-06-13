import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { environment } from '@env/environment';
import { Toaster } from '@shared/components/toast/toast';
import { BillingGateway } from './billing.gateway';
import { ExternalNavigator } from './external-navigator';

const BASE = environment.apiUrl;

function setup() {
  const assign = vi.fn();
  const error = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      BillingGateway,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: ExternalNavigator, useValue: { assign } },
      { provide: Toaster, useValue: { error, info: vi.fn(), success: vi.fn() } },
    ],
  });
  return {
    gateway: TestBed.inject(BillingGateway),
    httpController: TestBed.inject(HttpTestingController),
    assign,
    error,
  };
}

describe('BillingGateway', () => {
  let env: ReturnType<typeof setup>;

  beforeEach(() => {
    env = setup();
  });

  describe('checkout', () => {
    it('POST /billing/checkout-session with planKey and redirects to the returned url', async () => {
      const promise = env.gateway.checkout('family');

      const req = env.httpController.expectOne({
        method: 'POST',
        url: `${BASE}/billing/checkout-session`,
      });
      expect(req.request.body).toEqual({ planKey: 'family' });
      req.flush({ url: 'https://stripe/x' });
      await promise;
      env.httpController.verify();

      expect(env.assign).toHaveBeenCalledTimes(1);
      expect(env.assign).toHaveBeenCalledWith('https://stripe/x');
      expect(env.error).not.toHaveBeenCalled();
    });

    it.each([{ planKey: 'family' as const }, { planKey: 'family_health' as const }])(
      'sends planKey=$planKey in the body',
      async ({ planKey }) => {
        const promise = env.gateway.checkout(planKey);

        const req = env.httpController.expectOne({
          method: 'POST',
          url: `${BASE}/billing/checkout-session`,
        });
        expect(req.request.body).toEqual({ planKey });
        req.flush({ url: 'https://stripe/x' });
        await promise;
        env.httpController.verify();
      },
    );

    it('on HTTP error toasts and does not redirect', async () => {
      const promise = env.gateway.checkout('family');

      const req = env.httpController.expectOne({
        method: 'POST',
        url: `${BASE}/billing/checkout-session`,
      });
      req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await promise;
      env.httpController.verify();

      expect(env.error).toHaveBeenCalledTimes(1);
      expect(env.assign).not.toHaveBeenCalled();
    });
  });

  describe('openPortal', () => {
    it('POST /billing/portal and redirects to the returned url', async () => {
      const promise = env.gateway.openPortal();

      const req = env.httpController.expectOne({
        method: 'POST',
        url: `${BASE}/billing/portal`,
      });
      req.flush({ url: 'https://stripe/portal' });
      await promise;
      env.httpController.verify();

      expect(env.assign).toHaveBeenCalledTimes(1);
      expect(env.assign).toHaveBeenCalledWith('https://stripe/portal');
      expect(env.error).not.toHaveBeenCalled();
    });

    it('on HTTP error toasts and does not redirect', async () => {
      const promise = env.gateway.openPortal();

      const req = env.httpController.expectOne({
        method: 'POST',
        url: `${BASE}/billing/portal`,
      });
      req.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await promise;
      env.httpController.verify();

      expect(env.error).toHaveBeenCalledTimes(1);
      expect(env.assign).not.toHaveBeenCalled();
    });
  });
});
