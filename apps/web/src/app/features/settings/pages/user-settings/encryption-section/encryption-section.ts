import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/auth.store';
import { AuthEncryptionStore } from '@features/auth/auth-encryption.store';
import { RecoveryKeyCheckStore } from '@features/auth/recovery-key-check.store';
import { AUTO_LOCK_OPTIONS, AutoLockStore } from '@core/services/crypto/auto-lock.store';
import { RecoveryKeyModal } from '@features/auth/components/recovery-key-modal/recovery-key-modal';
import { Toaster } from '@shared/components/toast/toast';

type RecoveryPanel = 'none' | 'verify' | 'rotate';

@Component({
  selector: 'app-encryption-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RecoveryKeyModal, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page, sinon 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
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

          <div class="space-y-1.5">
            <label for="auto-lock" class="text-sm font-medium text-text-primary">
              {{ 'settings.encryption.autoLock.label' | transloco }}
            </label>
            <select
              id="auto-lock"
              data-testid="auto-lock-select"
              [value]="autoLock.minutes()"
              (change)="setAutoLock($event)"
              class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
            >
              @for (option of autoLockOptions; track option) {
                <option [value]="option" [selected]="option === autoLock.minutes()">
                  {{
                    option === 0
                      ? ('settings.encryption.autoLock.never' | transloco)
                      : ('settings.encryption.autoLock.minutes' | transloco: { count: option })
                  }}
                </option>
              }
            </select>
            <p class="text-xs text-text-muted">
              {{ 'settings.encryption.autoLock.help' | transloco }}
            </p>
          </div>

          <div class="space-y-3 border-t border-border pt-4">
            <h4 class="text-sm font-medium text-text-primary">
              {{ 'settings.encryption.recovery.title' | transloco }}
            </h4>
            @if (checkDue()) {
              <p
                data-testid="recovery-check-due"
                class="rounded-lg border border-ib-amber/20 bg-ib-amber/10 p-3 text-sm text-text-primary"
              >
                {{ 'settings.encryption.recovery.due' | transloco }}
              </p>
            }

            @switch (panel()) {
              @case ('verify') {
                <form class="space-y-2" (submit)="$event.preventDefault(); verifyRecoveryKey()">
                  <label for="recovery-check" class="text-sm text-text-primary">
                    {{ 'settings.encryption.recovery.verifyLabel' | transloco }}
                  </label>
                  <textarea
                    id="recovery-check"
                    rows="3"
                    autocomplete="off"
                    spellcheck="false"
                    class="w-full rounded-lg border border-border bg-canvas px-3 py-2 font-mono text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    [value]="secret()"
                    (input)="setSecret($event)"
                  ></textarea>
                  @if (panelError(); as message) {
                    <p role="alert" class="text-sm text-ib-red">{{ message | transloco }}</p>
                  }
                  <div class="flex gap-2">
                    <button
                      type="submit"
                      data-testid="recovery-verify-submit"
                      [disabled]="encryptionLoading() || normalizedRecoveryKey().length !== 64"
                      class="flex-1 rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-medium text-canvas disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{ 'settings.encryption.recovery.verify' | transloco }}
                    </button>
                    <button
                      type="button"
                      (click)="closePanel()"
                      class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-primary hover:bg-raised"
                    >
                      {{ 'settings.encryption.recovery.cancel' | transloco }}
                    </button>
                  </div>
                </form>
              }
              @case ('rotate') {
                <form class="space-y-2" (submit)="$event.preventDefault(); regenerateRecoveryKey()">
                  <p class="text-sm text-text-muted">
                    {{ 'settings.encryption.recovery.rotateExplain' | transloco }}
                  </p>
                  <label for="recovery-rotate-secret" class="text-sm text-text-primary">
                    {{
                      (auth.user()?.hasEncryptionPassphrase
                        ? 'settings.encryption.recovery.passphraseLabel'
                        : 'settings.encryption.recovery.passwordLabel'
                      ) | transloco
                    }}
                  </label>
                  <input
                    id="recovery-rotate-secret"
                    type="password"
                    autocomplete="current-password"
                    class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    [value]="secret()"
                    (input)="setSecret($event)"
                  />
                  @if (panelError(); as message) {
                    <p role="alert" class="text-sm text-ib-red">{{ message | transloco }}</p>
                  }
                  <div class="flex gap-2">
                    <button
                      type="submit"
                      data-testid="recovery-rotate-submit"
                      [disabled]="encryptionLoading() || !secret()"
                      class="flex-1 rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-medium text-canvas disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {{
                        (encryptionLoading()
                          ? 'settings.encryption.regenerating'
                          : 'settings.encryption.regenerate'
                        ) | transloco
                      }}
                    </button>
                    <button
                      type="button"
                      (click)="closePanel()"
                      class="rounded-lg border border-border px-4 py-2.5 text-sm text-text-primary hover:bg-raised"
                    >
                      {{ 'settings.encryption.recovery.cancel' | transloco }}
                    </button>
                  </div>
                </form>
              }
              @default {
                <div class="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    data-testid="recovery-verify-open"
                    (click)="openPanel('verify')"
                    class="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-raised"
                  >
                    {{ 'settings.encryption.recovery.verifyOpen' | transloco }}
                  </button>
                  <button
                    type="button"
                    data-testid="recovery-rotate-open"
                    (click)="openPanel('rotate')"
                    class="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-raised"
                  >
                    {{ 'settings.encryption.regenerate' | transloco }}
                  </button>
                </div>
              }
            }
          </div>
        }
      </div>
    </section>

    <app-recovery-key-modal
      [recoveryKey]="settingsRecoveryKey()"
      (keySaved)="onRecoveryKeyRegenerated()"
    />
  `,
})
export class EncryptionSection {
  protected readonly auth = inject(AuthStore);
  private readonly authEncryption = inject(AuthEncryptionStore);
  private readonly recoveryCheck = inject(RecoveryKeyCheckStore);
  private readonly router = inject(Router);
  private readonly toaster = inject(Toaster);

  protected readonly autoLock = inject(AutoLockStore);
  protected readonly autoLockOptions = AUTO_LOCK_OPTIONS;

  protected readonly encryptionLoading = signal(false);
  protected readonly settingsRecoveryKey = signal('');
  private readonly recoveryModal = viewChild(RecoveryKeyModal);

  protected readonly panel = signal<RecoveryPanel>('none');
  /** Saisie du panneau ouvert : clé de récupération à vérifier, ou mot de passe / passphrase. */
  protected readonly secret = signal('');
  protected readonly panelError = signal('');
  protected readonly normalizedRecoveryKey = computed(() => this.secret().replace(/\s/g, ''));

  protected readonly checkDue = computed(() => this.recoveryCheck.isDue());

  constructor() {
    // La page des réglages est derrière le guard d'authentification : le compte est connu ici.
    const userId = this.auth.user()?.id;
    if (userId) this.recoveryCheck.forUser(userId);
  }

  protected setAutoLock(event: Event): void {
    this.autoLock.setMinutes(Number((event.target as HTMLSelectElement).value));
  }

  protected goToEncryptionSetup(): void {
    this.router.navigate(['/auth/encryption-setup']);
  }

  protected openPanel(panel: RecoveryPanel): void {
    this.secret.set('');
    this.panelError.set('');
    this.panel.set(panel);
  }

  protected closePanel(): void {
    this.openPanel('none');
  }

  protected setSecret(event: Event): void {
    this.secret.set((event.target as HTMLInputElement | HTMLTextAreaElement).value);
  }

  protected async verifyRecoveryKey(): Promise<void> {
    this.encryptionLoading.set(true);
    this.panelError.set('');
    try {
      if (await this.authEncryption.verifyRecoveryKey(this.normalizedRecoveryKey())) {
        this.recoveryCheck.markChecked();
        this.closePanel();
        this.toaster.success('settings.encryption.feedback.recoveryValid');
      } else {
        this.panelError.set('settings.encryption.feedback.recoveryInvalid');
      }
    } catch {
      this.panelError.set('settings.encryption.feedback.recoveryCheckFailed');
    } finally {
      this.encryptionLoading.set(false);
    }
  }

  protected async regenerateRecoveryKey(): Promise<void> {
    this.encryptionLoading.set(true);
    this.panelError.set('');
    try {
      // La clé n'est affichée qu'une fois enregistrée côté serveur : avant, elle n'ouvrirait rien.
      const recoveryKey = await this.authEncryption.rotateRecoveryKey(this.secret());
      this.recoveryCheck.markChecked();
      this.closePanel();
      this.settingsRecoveryKey.set(recoveryKey);
      this.recoveryModal()?.open();
    } catch {
      this.panelError.set('settings.encryption.feedback.regenFailed');
    } finally {
      this.encryptionLoading.set(false);
    }
  }

  protected onRecoveryKeyRegenerated(): void {
    this.toaster.success('settings.encryption.feedback.regenerated');
  }
}
