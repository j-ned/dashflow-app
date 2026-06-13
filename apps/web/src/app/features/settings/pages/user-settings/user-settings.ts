import { ChangeDetectionStrategy, Component, effect, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Toaster } from '@shared/components/toast/toast';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import { ProfileSection } from './profile-section/profile-section';
import { PasswordSection } from './password-section/password-section';
import { TwoFactorSection } from './two-factor-section/two-factor-section';
import { EncryptionSection } from './encryption-section/encryption-section';
import { DangerZoneSection } from './danger-zone-section/danger-zone-section';
import { FamilySharingSection } from './family-sharing-section/family-sharing-section';
import { BillingSection } from './billing-section/billing-section';

@Component({
  selector: 'app-user-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoPipe,
    ProfileSection,
    PasswordSection,
    TwoFactorSection,
    EncryptionSection,
    DangerZoneSection,
    FamilySharingSection,
    BillingSection,
  ],
  host: { class: 'block w-full h-full overflow-y-auto' },
  template: `
    <div class="max-w-5xl mx-auto p-6 pb-12">
      <header class="mb-8 border-b border-border pb-6">
        <h2 class="text-2xl font-bold text-text-primary tracking-tight">
          {{ 'settings.title' | transloco }}
        </h2>
        <p class="mt-2 text-sm text-text-muted">
          {{ 'settings.subtitle' | transloco }}
        </p>
      </header>

      <app-profile-section />

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <app-password-section />
        <app-two-factor-section />
      </div>

      <app-billing-section />

      <app-family-sharing-section />

      <app-encryption-section />

      <app-danger-zone-section />
    </div>
  `,
})
export class UserSettings {
  readonly checkout = input<string>();

  private readonly toaster = inject(Toaster);
  private readonly entitlement = inject(EntitlementStore);

  constructor() {
    effect(() => {
      if (this.checkout() === 'success') {
        this.toaster.success('billing.success');
        void this.entitlement.reload();
      }
    });
  }
}
