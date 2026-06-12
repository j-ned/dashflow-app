import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { RecoveryKeyModal } from '@features/auth/components/recovery-key-modal/recovery-key-modal';
import { Toaster } from '@shared/components/toast/toast';

@Component({
  selector: 'app-encryption-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecoveryKeyModal, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <!-- ── Encryption ── -->
    <section
      aria-labelledby="encryption-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <div class="flex items-center justify-between">
          <div>
            <h3 id="encryption-heading" class="text-base font-semibold text-text-primary">
              {{ 'settings.encryption.title' | transloco }}
            </h3>
            <p class="text-sm text-text-muted mt-1">
              {{ 'settings.encryption.subtitle' | transloco }}
            </p>
          </div>
          @if (auth.encryptionVersion() === 1) {
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-ib-green/10 px-3 py-1 text-xs font-semibold text-ib-green border border-ib-green/20"
            >
              {{ 'settings.encryption.active' | transloco }}
            </span>
          } @else {
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-ib-amber/10 px-3 py-1 text-xs font-semibold text-ib-amber border border-ib-amber/20"
            >
              {{ 'settings.encryption.notConfigured' | transloco }}
            </span>
          }
        </div>
      </div>

      <div class="p-6 space-y-4">
        @if (auth.encryptionVersion() === 0) {
          <p class="text-sm text-text-muted">
            {{ 'settings.encryption.notActiveExplain' | transloco }}
          </p>
          <button
            type="button"
            (click)="goToEncryptionSetup()"
            class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-canvas transition hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
          >
            {{ 'settings.encryption.activate' | transloco }}
          </button>
        } @else {
          <div class="flex items-center gap-3 text-sm text-text-primary">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-ib-green/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="text-ib-green"
                aria-hidden="true"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            {{ 'settings.encryption.protectedNote' | transloco }}
          </div>

          <button
            type="button"
            (click)="regenerateRecoveryKey()"
            [disabled]="encryptionLoading()"
            class="w-full inline-flex items-center justify-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-raised disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{
              (encryptionLoading()
                ? 'settings.encryption.regenerating'
                : 'settings.encryption.regenerate'
              ) | transloco
            }}
          </button>
        }
      </div>
    </section>

    <app-recovery-key-modal
      [recoveryKey]="settingsRecoveryKey()"
      (confirmed$)="onRecoveryKeyRegenerated()"
    />
  `,
})
export class EncryptionSection {
  protected readonly auth = inject(AuthStore);
  private readonly crypto = inject(CryptoStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly encryptionLoading = signal(false);
  protected readonly settingsRecoveryKey = signal('');
  private readonly recoveryModal = viewChild(RecoveryKeyModal);

  protected goToEncryptionSetup(): void {
    this.router.navigate(['/auth/encryption-setup']);
  }

  protected async regenerateRecoveryKey(): Promise<void> {
    this.encryptionLoading.set(true);
    try {
      const masterKey = this.crypto.getMasterKey();
      if (!masterKey) {
        this.toaster.error('settings.encryption.feedback.locked');
        return;
      }

      const recoveryKey = this.crypto.generateRecoveryKey();
      const recoveryWrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryKey);
      await this.crypto.wrapKey(masterKey, recoveryWrappingKey);

      this.settingsRecoveryKey.set(recoveryKey);
      this.recoveryModal()?.open();
    } catch {
      this.toaster.error('settings.encryption.feedback.regenFailed');
    } finally {
      this.encryptionLoading.set(false);
    }
  }

  protected onRecoveryKeyRegenerated(): void {
    this.toaster.success('settings.encryption.feedback.regenerated');
  }
}
