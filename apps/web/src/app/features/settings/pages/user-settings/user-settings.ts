import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProfileSection } from './profile-section/profile-section';
import { PasswordSection } from './password-section/password-section';
import { TwoFactorSection } from './two-factor-section/two-factor-section';
import { EncryptionSection } from './encryption-section/encryption-section';
import { DangerZoneSection } from './danger-zone-section/danger-zone-section';

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

      <app-encryption-section />

      <app-danger-zone-section />
    </div>
  `,
})
export class UserSettings {}
