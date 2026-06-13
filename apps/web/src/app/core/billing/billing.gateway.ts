import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import { Toaster } from '@shared/components/toast/toast';
import type { PlanKey } from '@core/entitlements/entitlement.types';
import { ExternalNavigator } from './external-navigator';

type CheckoutResponse = { readonly url: string };

@Injectable({ providedIn: 'root' })
export class BillingGateway {
  private readonly api = inject(ApiClient);
  private readonly nav = inject(ExternalNavigator);
  private readonly toaster = inject(Toaster);

  async checkout(planKey: Extract<PlanKey, 'family' | 'family_health'>): Promise<void> {
    try {
      const { url } = await firstValueFrom(
        this.api.post<CheckoutResponse>('/billing/checkout-session', { planKey }),
      );
      this.nav.assign(url);
    } catch {
      this.toaster.error('billing.error');
    }
  }

  async openPortal(): Promise<void> {
    try {
      const { url } = await firstValueFrom(this.api.post<CheckoutResponse>('/billing/portal', {}));
      this.nav.assign(url);
    } catch {
      this.toaster.error('billing.error');
    }
  }
}
