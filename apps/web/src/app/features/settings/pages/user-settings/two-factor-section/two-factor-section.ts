import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/auth.store';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';

@Component({
  selector: 'app-two-factor-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <!-- 2FA -->
    <section
      aria-labelledby="2fa-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <div class="flex items-center justify-between">
          <div>
            <h3 id="2fa-heading" class="text-base font-semibold text-text-primary">
              {{ 'settings.twoFactor.title' | transloco }}
            </h3>
            <p class="text-sm text-text-muted mt-1">
              {{ 'settings.twoFactor.subtitle' | transloco }}
            </p>
          </div>
          @if (auth.totpEnabled()) {
            <span
              class="inline-flex items-center gap-1.5 rounded-full bg-ib-green/10 px-3 py-1 text-xs font-semibold text-ib-green border border-ib-green/20"
            >
              {{ 'settings.twoFactor.enabled' | transloco }}
            </span>
          }
        </div>
      </div>

      <div class="p-6">
        @if (backupCodes(); as codes) {
          <!-- Codes de secours : montrés une seule fois -->
          <div class="space-y-4" data-testid="backup-codes-panel">
            <div class="rounded-lg border border-ib-yellow/30 bg-ib-yellow/5 p-4">
              <p class="text-sm font-semibold text-text-primary">
                {{ 'settings.twoFactor.backup.title' | transloco }}
              </p>
              <p class="mt-1 text-sm text-text-muted">
                {{ 'settings.twoFactor.backup.explain' | transloco }}
              </p>
            </div>
            <ol
              class="grid grid-cols-2 gap-2 rounded-lg border border-border bg-canvas p-4 font-mono text-sm text-text-primary select-all"
              [attr.aria-label]="'settings.twoFactor.backup.listAria' | transloco"
            >
              @for (code of codes; track code) {
                <li class="tabular-nums">{{ code }}</li>
              }
            </ol>
            <div class="flex flex-wrap gap-3">
              <button
                type="button"
                (click)="copyBackupCodes()"
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-raised"
              >
                <app-icon [name]="copied() ? 'check' : 'copy'" size="16" />
                {{
                  (copied() ? 'settings.twoFactor.backup.copied' : 'settings.twoFactor.backup.copy')
                    | transloco
                }}
              </button>
              <button
                type="button"
                (click)="downloadBackupCodes()"
                class="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-raised"
              >
                <app-icon name="download" size="16" />
                {{ 'settings.twoFactor.backup.download' | transloco }}
              </button>
            </div>
            <button
              type="button"
              (click)="dismissBackupCodes()"
              class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-canvas transition hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
            >
              {{ 'settings.twoFactor.backup.saved' | transloco }}
            </button>
          </div>
        } @else if (auth.totpEnabled()) {
          <!-- 2FA is enabled: show backup codes status + disable option -->
          <div class="space-y-4">
            <p class="text-sm text-text-primary">
              {{ 'settings.twoFactor.enabledExplain' | transloco }}
            </p>
            @if (remaining(); as r) {
              <p
                class="text-sm"
                [class.text-text-muted]="r.count > 2"
                [class.text-ib-orange]="r.count <= 2"
                data-testid="backup-codes-remaining"
              >
                {{ 'settings.twoFactor.backup.remaining' | transloco: { count: r.count } }}
              </p>
            }
            <div class="space-y-1.5">
              <label for="disable-2fa-password" class="text-sm font-medium text-text-primary">
                {{ 'settings.twoFactor.passwordLabel' | transloco }}
                <span aria-hidden="true" class="text-ib-red">*</span>
              </label>
              <div class="relative">
                <input
                  #disable2faInput
                  id="disable-2fa-password"
                  [type]="showDisable2faPassword() ? 'text' : 'password'"
                  (input)="disablePassword.set(disable2faInput.value)"
                  class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-12 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                />
                <button
                  type="button"
                  (click)="showDisable2faPassword.set(!showDisable2faPassword())"
                  class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                  [attr.aria-label]="
                    (showDisable2faPassword() ? 'auth.hide' : 'auth.show') | transloco
                  "
                >
                  <app-icon [name]="showDisable2faPassword() ? 'eye-off' : 'eye'" size="18" />
                </button>
              </div>
            </div>
            <div class="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                (click)="regenerateBackupCodes()"
                [disabled]="!disablePassword() || totpLoading()"
                class="flex-1 inline-flex items-center justify-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-primary transition hover:bg-raised disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ 'settings.twoFactor.backup.regenerate' | transloco }}
              </button>
              <button
                type="button"
                (click)="disable2FA()"
                [disabled]="!disablePassword() || totpLoading()"
                class="flex-1 inline-flex items-center justify-center rounded-lg border border-ib-red/30 bg-ib-red/5 px-6 py-2.5 text-sm font-medium text-ib-red transition hover:bg-ib-red/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{
                  (totpLoading() ? 'settings.twoFactor.disabling' : 'settings.twoFactor.disable')
                    | transloco
                }}
              </button>
            </div>
          </div>
        } @else if (totpSetup()) {
          <!-- Setup in progress: show QR + verify -->
          <div class="space-y-5">
            <p class="text-sm text-text-primary">
              {{ 'settings.twoFactor.scanExplain' | transloco }}
            </p>

            <div class="flex justify-center">
              <!-- bg-white intentional: QR scanners require white background regardless of theme -->
              <!-- eslint-disable @angular-eslint/template/prefer-ngsrc -- QR code en data: URL, non supportée par NgOptimizedImage -->
              <img
                [src]="totpSetup()!.qrCode"
                [alt]="'settings.twoFactor.qrAlt' | transloco"
                class="w-48 h-48 rounded-lg border border-border bg-white p-2"
              />
              <!-- eslint-enable @angular-eslint/template/prefer-ngsrc -->
            </div>

            <details class="text-sm">
              <summary
                class="cursor-pointer text-text-muted hover:text-text-primary transition-colors"
              >
                {{ 'settings.twoFactor.manualKey' | transloco }}
              </summary>
              <code
                class="mt-2 block rounded-lg bg-canvas p-3 text-xs font-mono text-text-primary break-all select-all border border-border"
              >
                {{ totpSetup()!.secret }}
              </code>
            </details>

            <div class="space-y-1.5">
              <label for="verify-totp" class="text-sm font-medium text-text-primary">
                {{ 'settings.twoFactor.verifyCode' | transloco }}
                <span aria-hidden="true" class="text-ib-red">*</span>
              </label>
              <input
                #verifyTotpInput
                id="verify-totp"
                type="text"
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                autocomplete="one-time-code"
                (input)="totpVerifyCode.set(verifyTotpInput.value)"
                class="w-full rounded-lg border border-border bg-surface px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="000000"
              />
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                (click)="totpSetup.set(null)"
                class="flex-1 inline-flex items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-raised"
              >
                {{ 'settings.twoFactor.cancel' | transloco }}
              </button>
              <button
                type="button"
                (click)="verify2FA()"
                [disabled]="totpVerifyCode().length !== 6 || totpLoading()"
                class="flex-1 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
              >
                {{
                  (totpLoading() ? 'settings.twoFactor.activating' : 'settings.twoFactor.activate')
                    | transloco
                }}
              </button>
            </div>
          </div>
        } @else {
          <!-- 2FA not enabled: show setup button -->
          <div class="space-y-4">
            <p class="text-sm text-text-muted">
              {{ 'settings.twoFactor.setupExplain' | transloco }}
            </p>
            <button
              type="button"
              (click)="setup2FA()"
              [disabled]="totpLoading()"
              class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
            >
              {{
                (totpLoading() ? 'settings.twoFactor.settingUp' : 'settings.twoFactor.setup')
                  | transloco
              }}
            </button>
          </div>
        }
      </div>
    </section>
  `,
})
export class TwoFactorSection {
  protected readonly auth = inject(AuthStore);
  private readonly toaster = inject(Toaster);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showDisable2faPassword = signal(false);
  protected readonly totpSetup = signal<{ qrCode: string; secret: string } | null>(null);
  protected readonly totpVerifyCode = signal('');
  protected readonly totpLoading = signal(false);
  protected readonly disablePassword = signal('');
  /** Codes de secours fraîchement émis : visibles jusqu'à « J'ai enregistré mes codes ». */
  protected readonly backupCodes = signal<string[] | null>(null);
  protected readonly copied = signal(false);
  /** Codes restants (objet pour distinguer « 0 » de « pas encore chargé » dans le template). */
  protected readonly remaining = signal<{ count: number } | null>(null);
  private _copiedTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Compteur rechargé quand la 2FA devient active (activation, hydratation de session).
    effect(() => {
      if (this.auth.totpEnabled()) void this.refreshRemaining();
      else this.remaining.set(null);
    });
    this.destroyRef.onDestroy(() => clearTimeout(this._copiedTimeout));
  }

  private async refreshRemaining(): Promise<void> {
    try {
      this.remaining.set({ count: await this.auth.backupCodesRemaining() });
    } catch {
      this.remaining.set(null);
    }
  }

  protected async copyBackupCodes(): Promise<void> {
    const codes = this.backupCodes();
    if (!codes) return;
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      this.copied.set(true);
      clearTimeout(this._copiedTimeout);
      this._copiedTimeout = setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.toaster.error('settings.twoFactor.backup.copyFailed');
    }
  }

  protected downloadBackupCodes(): void {
    const codes = this.backupCodes();
    if (!codes) return;
    const blob = new Blob([`DashFlow — codes de secours 2FA\n\n${codes.join('\n')}\n`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashflow-codes-de-secours.txt';
    a.click();
    URL.revokeObjectURL(url);
  }

  protected dismissBackupCodes(): void {
    this.backupCodes.set(null);
    void this.refreshRemaining();
  }

  protected async regenerateBackupCodes(): Promise<void> {
    const password = this.disablePassword();
    if (!password) return;
    this.totpLoading.set(true);
    try {
      const codes = await this.auth.regenerateBackupCodes(password);
      this.disablePassword.set('');
      this.backupCodes.set(codes);
      this.toaster.success('settings.twoFactor.backup.regenerated');
    } catch {
      this.toaster.error('settings.twoFactor.feedback.wrongPassword');
    } finally {
      this.totpLoading.set(false);
    }
  }

  protected async setup2FA() {
    this.totpLoading.set(true);
    try {
      const data = await this.auth.setup2FA();
      this.totpSetup.set(data);
    } catch {
      this.toaster.error('settings.twoFactor.feedback.setupFailed');
    } finally {
      this.totpLoading.set(false);
    }
  }

  protected async verify2FA() {
    const code = this.totpVerifyCode().trim();
    if (code.length !== 6) return;

    this.totpLoading.set(true);
    try {
      const codes = await this.auth.verify2FA(code);
      this.totpSetup.set(null);
      this.totpVerifyCode.set('');
      this.backupCodes.set(codes.length > 0 ? codes : null);
      this.toaster.success('settings.twoFactor.feedback.activated');
    } catch {
      this.toaster.error('settings.twoFactor.feedback.invalidCode');
    } finally {
      this.totpLoading.set(false);
    }
  }

  protected async disable2FA() {
    const password = this.disablePassword();
    if (!password) return;

    this.totpLoading.set(true);
    try {
      await this.auth.disable2FA(password);
      this.disablePassword.set('');
      this.backupCodes.set(null);
      this.toaster.success('settings.twoFactor.feedback.deactivated');
    } catch {
      this.toaster.error('settings.twoFactor.feedback.wrongPassword');
    } finally {
      this.totpLoading.set(false);
    }
  }
}
