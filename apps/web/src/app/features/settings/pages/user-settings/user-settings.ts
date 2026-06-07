import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Icon } from '@shared/components/icon/icon';
import { RecoveryKeyModal } from '../../../auth/components/recovery-key-modal/recovery-key-modal';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { passwordMatchValidator } from '@shared/validators/form-validators';
import { Toaster } from '@shared/components/toast/toast';

type ProfileFormShape = {
  displayName: FormControl<string>;
};

type PasswordFormShape = {
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
};

@Component({
  selector: 'app-user-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, RecoveryKeyModal, TranslocoPipe],
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

      <!-- ── Profile ── -->
      <section
        aria-labelledby="profile-heading"
        class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
      >
        <div class="px-6 py-5 border-b border-border bg-surface/50">
          <h3 id="profile-heading" class="text-base font-semibold text-text-primary">
            {{ 'settings.profile.title' | transloco }}
          </h3>
          <p class="text-sm text-text-muted mt-1">{{ 'settings.profile.subtitle' | transloco }}</p>
        </div>
        <div class="p-6">
          <div class="flex flex-col sm:flex-row items-start gap-8">
            <div class="shrink-0 flex flex-col items-center gap-3">
              <button
                type="button"
                (click)="avatarInput.click()"
                class="group relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue transition-transform hover:scale-105"
              >
                @if (avatarPreview() || auth.avatarUrl()) {
                  <!-- eslint-disable @angular-eslint/template/prefer-ngsrc -- avatar dynamique : la preview est une data: URL, non supportée par NgOptimizedImage -->
                  <img
                    [src]="avatarPreview() || auth.avatarUrl()"
                    [alt]="'settings.profile.avatarAlt' | transloco"
                    class="w-24 h-24 rounded-full object-cover border-4 border-surface shadow-sm"
                  />
                  <!-- eslint-enable @angular-eslint/template/prefer-ngsrc -->
                } @else {
                  <div
                    class="w-24 h-24 rounded-full bg-linear-to-br from-ib-purple to-ib-blue flex items-center justify-center text-3xl font-bold text-canvas shadow-sm border-4 border-surface"
                  >
                    {{ auth.userInitial() }}
                  </div>
                }
                <div
                  class="absolute inset-0 rounded-full bg-canvas/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <app-icon name="camera" size="28" class="text-text-primary" />
                </div>
              </button>
              <input
                #avatarInput
                type="file"
                accept="image/*"
                class="hidden"
                (change)="onAvatarSelected($event)"
              />
            </div>

            <form
              [formGroup]="profileForm"
              (ngSubmit)="saveProfile()"
              class="flex-1 w-full space-y-5"
            >
              <fieldset class="space-y-5">
                <legend class="sr-only">{{ 'settings.profile.legend' | transloco }}</legend>
                <div class="space-y-1.5">
                  <label for="display-name" class="text-sm font-medium text-text-primary">{{
                    'settings.profile.displayName' | transloco
                  }}</label>
                  <input
                    id="display-name"
                    type="text"
                    formControlName="displayName"
                    class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                  />
                </div>
                <div class="space-y-1.5">
                  <label for="user-email" class="text-sm font-medium text-text-primary">{{
                    'settings.profile.email' | transloco
                  }}</label>
                  <input
                    id="user-email"
                    type="email"
                    [value]="auth.email()"
                    readonly
                    disabled
                    class="w-full rounded-lg border border-border/50 bg-raised px-4 py-2.5 text-sm text-text-muted cursor-not-allowed opacity-80"
                  />
                </div>
              </fieldset>
              <div class="pt-2 flex justify-end">
                <button
                  type="submit"
                  [disabled]="profileForm.pristine || profileSaving()"
                  class="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
                >
                  {{
                    (profileSaving() ? 'settings.profile.saving' : 'settings.profile.save')
                      | transloco
                  }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      <!-- ── Security Grid: Password + 2FA ── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <!-- Password -->
        <section
          aria-labelledby="password-heading"
          class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden"
        >
          <div class="px-6 py-5 border-b border-border bg-surface/50">
            <h3 id="password-heading" class="text-base font-semibold text-text-primary">
              {{ 'settings.password.title' | transloco }}
            </h3>
            <p class="text-sm text-text-muted mt-1">
              @if (auth.hasPassword()) {
                {{ 'settings.password.subtitleUpdate' | transloco }}
              } @else {
                {{ 'settings.password.subtitleSet' | transloco }}
              }
            </p>
          </div>

          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="p-6 space-y-5">
            <fieldset class="space-y-5">
              <legend class="sr-only">
                {{
                  (auth.hasPassword()
                    ? 'settings.password.legendUpdate'
                    : 'settings.password.legendSet'
                  ) | transloco
                }}
              </legend>

              @if (auth.hasPassword()) {
                <div class="space-y-1.5">
                  <label for="current-password" class="text-sm font-medium text-text-primary">
                    {{ 'settings.password.current' | transloco }}
                    <span aria-hidden="true" class="text-ib-red">*</span>
                  </label>
                  <div class="relative">
                    <input
                      id="current-password"
                      [type]="showCurrentPassword() ? 'text' : 'password'"
                      formControlName="currentPassword"
                      aria-required="true"
                      class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-12 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                    />
                    <button
                      type="button"
                      (click)="showCurrentPassword.set(!showCurrentPassword())"
                      class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                      [attr.aria-label]="
                        (showCurrentPassword() ? 'auth.hide' : 'auth.show') | transloco
                      "
                    >
                      <app-icon [name]="showCurrentPassword() ? 'eye-off' : 'eye'" size="18" />
                    </button>
                  </div>
                  @if (
                    passwordForm.controls.currentPassword.touched &&
                    passwordForm.controls.currentPassword.errors?.['required']
                  ) {
                    <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                      {{ 'settings.password.currentRequired' | transloco }}
                    </p>
                  }
                </div>
              }

              <div class="space-y-1.5">
                <label for="new-password" class="text-sm font-medium text-text-primary">
                  {{
                    (auth.hasPassword() ? 'settings.password.new' : 'settings.password.label')
                      | transloco
                  }}
                  <span aria-hidden="true" class="text-ib-red">*</span>
                </label>
                <div class="relative">
                  <input
                    id="new-password"
                    [type]="showNewPassword() ? 'text' : 'password'"
                    formControlName="newPassword"
                    aria-required="true"
                    class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-12 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                  />
                  <button
                    type="button"
                    (click)="showNewPassword.set(!showNewPassword())"
                    class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                    [attr.aria-label]="(showNewPassword() ? 'auth.hide' : 'auth.show') | transloco"
                  >
                    <app-icon [name]="showNewPassword() ? 'eye-off' : 'eye'" size="18" />
                  </button>
                </div>
                @if (passwordForm.controls.newPassword.touched) {
                  @if (passwordForm.controls.newPassword.errors?.['required']) {
                    <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                      {{ 'settings.password.required' | transloco }}
                    </p>
                  } @else if (passwordForm.controls.newPassword.errors?.['minlength']) {
                    <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                      {{ 'settings.password.minLength' | transloco }}
                    </p>
                  }
                }
              </div>

              <div class="space-y-1.5">
                <label for="confirm-password" class="text-sm font-medium text-text-primary">
                  {{ 'settings.password.confirm' | transloco }}
                  <span aria-hidden="true" class="text-ib-red">*</span>
                </label>
                <div class="relative">
                  <input
                    id="confirm-password"
                    [type]="showConfirmPassword() ? 'text' : 'password'"
                    formControlName="confirmPassword"
                    aria-required="true"
                    class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-12 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                  />
                  <button
                    type="button"
                    (click)="showConfirmPassword.set(!showConfirmPassword())"
                    class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                    [attr.aria-label]="
                      (showConfirmPassword() ? 'auth.hide' : 'auth.show') | transloco
                    "
                  >
                    <app-icon [name]="showConfirmPassword() ? 'eye-off' : 'eye'" size="18" />
                  </button>
                </div>
                @if (
                  (passwordForm.controls.newPassword.touched ||
                    passwordForm.controls.confirmPassword.touched) &&
                  passwordForm.errors?.['mismatch']
                ) {
                  <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                    {{ 'settings.password.mismatch' | transloco }}
                  </p>
                }
              </div>
            </fieldset>

            <div class="pt-2">
              <button
                type="submit"
                [disabled]="passwordForm.invalid || passwordSaving()"
                class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-canvas transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
              >
                @if (passwordSaving()) {
                  {{
                    (auth.hasPassword()
                      ? 'settings.password.submittingUpdate'
                      : 'settings.password.submittingSet'
                    ) | transloco
                  }}
                } @else {
                  {{
                    (auth.hasPassword()
                      ? 'settings.password.submitUpdate'
                      : 'settings.password.submitSet'
                    ) | transloco
                  }}
                }
              </button>
            </div>
          </form>
        </section>

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
            @if (auth.totpEnabled()) {
              <!-- 2FA is enabled — show disable option -->
              <div class="space-y-4">
                <p class="text-sm text-text-primary">
                  {{ 'settings.twoFactor.enabledExplain' | transloco }}
                </p>
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
                <button
                  type="button"
                  (click)="disable2FA()"
                  [disabled]="!disablePassword() || totpLoading()"
                  class="w-full inline-flex items-center justify-center rounded-lg border border-ib-red/30 bg-ib-red/5 px-6 py-2.5 text-sm font-medium text-ib-red transition hover:bg-ib-red/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{
                    (totpLoading() ? 'settings.twoFactor.disabling' : 'settings.twoFactor.disable')
                      | transloco
                  }}
                </button>
              </div>
            } @else if (totpSetup()) {
              <!-- Setup in progress — show QR + verify -->
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
                      (totpLoading()
                        ? 'settings.twoFactor.activating'
                        : 'settings.twoFactor.activate'
                      ) | transloco
                    }}
                  </button>
                </div>
              </div>
            } @else {
              <!-- 2FA not enabled — show setup button -->
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
      </div>

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

      <!-- ── Danger zone ── -->
      <section
        aria-labelledby="danger-heading"
        class="rounded-2xl border border-ib-red/20 bg-ib-red/2 shadow-sm overflow-hidden"
      >
        <div class="px-6 py-5 border-b border-ib-red/10 bg-ib-red/3">
          <h3
            id="danger-heading"
            class="text-base font-semibold text-ib-red flex items-center gap-2"
          >
            {{ 'settings.danger.title' | transloco }}
          </h3>
        </div>
        <div class="p-6">
          <p class="text-sm text-text-primary font-medium mb-1">
            {{ 'settings.danger.deleteHeading' | transloco }}
          </p>
          <p class="text-sm text-text-muted mb-5">
            {{ 'settings.danger.deleteWarning' | transloco }}
          </p>

          <div class="flex flex-col sm:flex-row gap-3">
            <input
              id="delete-confirm"
              type="text"
              #deleteInput
              (input)="deleteConfirmValue.set(deleteInput.value)"
              class="flex-1 rounded-lg border border-ib-red/30 bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-ib-red focus:outline-none focus:ring-1 focus:ring-ib-red placeholder:text-text-muted"
              [attr.placeholder]="auth.email()"
            />

            <button
              type="button"
              (click)="deleteAccount()"
              [disabled]="deleteConfirmValue() !== auth.email() || deleting()"
              class="inline-flex shrink-0 items-center justify-center rounded-lg bg-ib-red px-6 py-2.5 text-sm font-medium text-canvas hover:bg-ib-red/90 transition disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red focus-visible:ring-offset-2"
            >
              {{ (deleting() ? 'settings.danger.deleting' : 'settings.danger.delete') | transloco }}
            </button>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class UserSettings {
  protected readonly auth = inject(AuthStore);
  private readonly crypto = inject(CryptoStore);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);
  private readonly toaster = inject(Toaster);

  // Profile
  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly profileSaving = signal(false);
  protected readonly profileForm = new FormGroup<ProfileFormShape>({
    displayName: new FormControl('', { nonNullable: true }),
  });

  // Password
  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly showDisable2faPassword = signal(false);
  protected readonly passwordSaving = signal(false);
  protected readonly passwordForm = new FormGroup<PasswordFormShape>(
    {
      currentPassword: new FormControl('', { nonNullable: true }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(12)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator('newPassword', 'confirmPassword')] },
  );

  // 2FA
  protected readonly totpSetup = signal<{ qrCode: string; secret: string } | null>(null);
  protected readonly totpVerifyCode = signal('');
  protected readonly totpLoading = signal(false);
  protected readonly disablePassword = signal('');

  // Encryption
  protected readonly encryptionLoading = signal(false);
  protected readonly settingsRecoveryKey = signal('');
  private readonly recoveryModal = viewChild(RecoveryKeyModal);

  // Delete
  protected readonly deleteConfirmValue = signal('');
  protected readonly deleting = signal(false);

  constructor() {
    effect(() => {
      const name = this.auth.displayName();
      if (name && this.profileForm.pristine) {
        this.profileForm.patchValue({ displayName: name });
      }
    });
    effect(() => {
      if (this.auth.hasPassword()) {
        this.passwordForm.controls.currentPassword.addValidators(Validators.required);
      } else {
        this.passwordForm.controls.currentPassword.clearValidators();
      }
      this.passwordForm.controls.currentPassword.updateValueAndValidity();
    });
  }

  protected async onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    this.profileSaving.set(true);
    try {
      await this.auth.uploadAvatar(file);
      this.showFeedback('success', this._i18n.translate('settings.profile.feedback.avatarUpdated'));
    } catch {
      this.avatarPreview.set(null);
      this.showFeedback('error', this._i18n.translate('settings.profile.feedback.avatarFailed'));
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected async saveProfile() {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);
    try {
      await this.auth.updateProfile({ displayName: this.profileForm.getRawValue().displayName });
      this.showFeedback('success', this._i18n.translate('settings.profile.feedback.updated'));
      this.profileForm.markAsPristine();
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.profile.feedback.updateFailed'));
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected async changePassword() {
    if (this.passwordForm.invalid) return;
    this.passwordSaving.set(true);
    try {
      const { currentPassword, newPassword } = this.passwordForm.getRawValue();

      if (!this.auth.hasPassword()) {
        await this.auth.setPassword(newPassword);
        this.showFeedback('success', this._i18n.translate('settings.password.feedback.set'));
        this.passwordForm.controls.currentPassword.addValidators(Validators.required);
        this.passwordForm.controls.currentPassword.updateValueAndValidity();
      } else if (this.auth.encryptionVersion() === 1) {
        // E2EE: re-wrap obligatoire pour garder wrappedMasterKey synchro avec le nouveau mot de passe.
        // Si le CryptoStore est locked, on le déverrouille avec currentPassword avant.
        if (!this.crypto.isUnlocked()) {
          try {
            await this.auth.unlockWithPassword(currentPassword);
          } catch {
            this.showFeedback(
              'error',
              this._i18n.translate('settings.password.feedback.outOfSync'),
            );
            return;
          }
        }
        await this.auth.updatePasswordWithReWrap(currentPassword, newPassword);
        this.showFeedback('success', this._i18n.translate('settings.password.feedback.updated'));
      } else {
        await this.auth.updatePassword(currentPassword, newPassword);
        this.showFeedback('success', this._i18n.translate('settings.password.feedback.updated'));
      }
      this.passwordForm.reset();
    } catch {
      this.showFeedback(
        'error',
        this.auth.hasPassword()
          ? this._i18n.translate('settings.password.feedback.updateFailed')
          : this._i18n.translate('settings.password.feedback.setFailed'),
      );
    } finally {
      this.passwordSaving.set(false);
    }
  }

  // ── 2FA ──

  protected async setup2FA() {
    this.totpLoading.set(true);
    try {
      const data = await this.auth.setup2FA();
      this.totpSetup.set(data);
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.twoFactor.feedback.setupFailed'));
    } finally {
      this.totpLoading.set(false);
    }
  }

  protected async verify2FA() {
    const code = this.totpVerifyCode().trim();
    if (code.length !== 6) return;

    this.totpLoading.set(true);
    try {
      await this.auth.verify2FA(code);
      this.totpSetup.set(null);
      this.totpVerifyCode.set('');
      this.showFeedback('success', this._i18n.translate('settings.twoFactor.feedback.activated'));
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.twoFactor.feedback.invalidCode'));
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
      this.showFeedback('success', this._i18n.translate('settings.twoFactor.feedback.deactivated'));
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.twoFactor.feedback.wrongPassword'));
    } finally {
      this.totpLoading.set(false);
    }
  }

  // ── Delete ──

  protected async deleteAccount() {
    if (this.deleteConfirmValue() !== this.auth.email()) return;

    const confirmed = await this.confirm.confirm({
      title: this._i18n.translate('settings.danger.confirmTitle'),
      message: this._i18n.translate('settings.danger.confirmMessage'),
      confirmLabel: this._i18n.translate('settings.danger.confirmDelete'),
      cancelLabel: this._i18n.translate('common.cancel'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      await this.auth.deleteAccount();
      this.router.navigate(['/auth/login']);
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.danger.feedback.deleteFailed'));
      this.deleting.set(false);
    }
  }

  // ── Encryption ──

  protected goToEncryptionSetup(): void {
    this.router.navigate(['/auth/encryption-setup']);
  }

  protected async regenerateRecoveryKey(): Promise<void> {
    this.encryptionLoading.set(true);
    try {
      const masterKey = this.crypto.getMasterKey();
      if (!masterKey) {
        this.showFeedback('error', this._i18n.translate('settings.encryption.feedback.locked'));
        return;
      }

      const recoveryKey = this.crypto.generateRecoveryKey();
      const recoveryWrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryKey);
      await this.crypto.wrapKey(masterKey, recoveryWrappingKey);

      this.settingsRecoveryKey.set(recoveryKey);
      this.recoveryModal()?.open();
    } catch {
      this.showFeedback('error', this._i18n.translate('settings.encryption.feedback.regenFailed'));
    } finally {
      this.encryptionLoading.set(false);
    }
  }

  protected onRecoveryKeyRegenerated(): void {
    this.showFeedback('success', this._i18n.translate('settings.encryption.feedback.regenerated'));
  }

  private showFeedback(type: 'success' | 'error', message: string) {
    this.toaster[type](message);
  }
}
