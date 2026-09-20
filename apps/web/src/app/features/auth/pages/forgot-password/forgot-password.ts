import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { reportError } from '@core/monitoring/error-reporter';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { ApiError } from '@core/services/api/api-client';
import { AuthStore } from '../../auth.store';
import { AuthEncryptionStore } from '../../auth-encryption.store';
import { Icon } from '@shared/components/icon/icon';
import { PASSWORD_MIN_LENGTH, passwordMatchValidator } from '@shared/validators/form-validators';
import { ConfirmDialog, ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

type EmailFormShape = {
  email: FormControl<string>;
};

type ResetFormShape = {
  code: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
};

@Component({
  selector: 'app-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon, TranslocoPipe, ConfirmDialog],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <main>
      <article class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
        <header class="mb-8 text-center">
          <h1 class="text-2xl font-bold text-text-primary">DashFlow</h1>
          <p class="mt-2 text-sm text-text-muted">{{ 'auth.forgot.subtitle' | transloco }}</p>
        </header>

        @if (error()) {
          <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">
            {{ error() }}
          </p>
        }

        @if (success()) {
          <div class="mb-4 rounded-md bg-ib-green/10 p-3 text-sm text-ib-green">
            {{ success() }}
          </div>
        }

        @if (step() === 'email') {
          <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="flex flex-col gap-4">
            <fieldset class="flex flex-col gap-4">
              <legend class="sr-only">{{ 'auth.forgot.emailLegend' | transloco }}</legend>
              <div>
                <label for="email" class="mb-1.5 block text-sm font-medium text-text-primary">
                  {{ 'auth.forgot.email' | transloco }}
                  <span aria-hidden="true" class="text-ib-red">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  formControlName="email"
                  aria-required="true"
                  class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                  [placeholder]="'auth.forgot.emailPlaceholder' | transloco"
                />
                @if (emailForm.controls.email.touched) {
                  @if (emailForm.controls.email.errors?.['required']) {
                    <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                      'auth.forgot.emailRequired' | transloco
                    }}</small>
                  } @else if (emailForm.controls.email.errors?.['email']) {
                    <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                      'auth.forgot.emailInvalid' | transloco
                    }}</small>
                  }
                }
              </div>
            </fieldset>

            <button
              type="submit"
              data-testid="forgot-email-submit"
              [disabled]="emailForm.invalid || loading()"
              class="mt-2 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ (loading() ? 'auth.forgot.sending' : 'auth.forgot.sendCode') | transloco }}
            </button>

            <p class="mt-4 text-center text-sm text-text-muted">
              <a routerLink="/auth/login" class="font-medium text-ib-blue hover:underline">{{
                'auth.forgot.backToLogin' | transloco
              }}</a>
            </p>
          </form>
        }

        @if (step() === 'reset') {
          <div
            class="mb-4 rounded-lg bg-ib-blue/5 border border-ib-blue/20 p-4 text-center"
            data-testid="forgot-reset-step"
          >
            <p class="text-sm text-text-primary">
              {{ 'auth.forgot.codeSentTo' | transloco }} <strong>{{ pendingEmail() }}</strong>
            </p>
          </div>

          <form [formGroup]="resetForm" (ngSubmit)="submitReset()" class="flex flex-col gap-4">
            <fieldset class="flex flex-col gap-4">
              <legend class="sr-only">{{ 'auth.forgot.resetLegend' | transloco }}</legend>
              <div>
                <label
                  for="code"
                  class="mb-1.5 block text-sm font-medium text-text-primary text-center"
                >
                  {{ 'auth.forgot.codeLabel' | transloco }}
                </label>
                <input
                  id="code"
                  type="text"
                  inputmode="numeric"
                  pattern="[0-9]{6}"
                  maxlength="6"
                  autocomplete="one-time-code"
                  formControlName="code"
                  class="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                  placeholder="000000"
                />
              </div>

              <div>
                <label for="newPassword" class="mb-1.5 block text-sm font-medium text-text-primary">
                  {{ 'auth.forgot.newPassword' | transloco }}
                  <span aria-hidden="true" class="text-ib-red">*</span>
                </label>
                <div class="relative">
                  <input
                    [type]="showNewPassword() ? 'text' : 'password'"
                    id="newPassword"
                    formControlName="newPassword"
                    aria-required="true"
                    class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-12 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    [placeholder]="'auth.forgot.passwordPlaceholder' | transloco"
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
                @if (
                  resetForm.controls.newPassword.touched &&
                  resetForm.controls.newPassword.errors?.['minlength']
                ) {
                  <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                    'auth.forgot.passwordMinLength' | transloco
                  }}</small>
                }
              </div>

              <div>
                <label
                  for="confirmPassword"
                  class="mb-1.5 block text-sm font-medium text-text-primary"
                >
                  {{ 'auth.forgot.confirmPassword' | transloco }}
                  <span aria-hidden="true" class="text-ib-red">*</span>
                </label>
                <div class="relative">
                  <input
                    [type]="showConfirmPassword() ? 'text' : 'password'"
                    id="confirmPassword"
                    formControlName="confirmPassword"
                    aria-required="true"
                    class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-12 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                    [placeholder]="'auth.forgot.passwordPlaceholder' | transloco"
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
                  (resetForm.controls.newPassword.touched ||
                    resetForm.controls.confirmPassword.touched) &&
                  resetForm.errors?.['mismatch']
                ) {
                  <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                    'auth.forgot.passwordsMismatch' | transloco
                  }}</small>
                }
              </div>
            </fieldset>

            <button
              type="submit"
              data-testid="forgot-reset-submit"
              [disabled]="resetForm.invalid || loading()"
              class="mt-2 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ (loading() ? 'auth.forgot.submitting' : 'auth.forgot.submit') | transloco }}
            </button>

            <div class="mt-2 flex justify-between text-sm">
              <button
                type="button"
                (click)="resendCode()"
                [disabled]="loading()"
                class="text-text-muted hover:text-text-primary transition-colors"
              >
                {{ 'auth.forgot.resend' | transloco }}
              </button>
              <button
                type="button"
                (click)="backToEmail()"
                class="text-text-muted hover:text-text-primary transition-colors"
              >
                {{ 'auth.forgot.editEmail' | transloco }}
              </button>
            </div>
          </form>
        }

        @if (step() === 'recovery') {
          <div class="flex flex-col gap-4">
            <div class="rounded-lg bg-ib-amber/10 border border-ib-amber/20 p-4">
              <p class="text-sm font-medium text-ib-amber">
                {{ 'auth.forgot.encryptedDetected' | transloco }}
              </p>
              <p class="mt-1 text-sm text-text-primary">
                {{ 'auth.forgot.encryptedExplain' | transloco }}
              </p>
            </div>

            <div>
              <label for="recoveryKey" class="mb-1.5 block text-sm font-medium text-text-primary">
                {{ 'auth.forgot.recoveryKeyLabel' | transloco }}
              </label>
              <textarea
                id="recoveryKey"
                rows="3"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                [placeholder]="'auth.forgot.recoveryKeyPlaceholder' | transloco"
                (input)="onRecoveryKeyInput($event)"
              ></textarea>
            </div>

            <button
              type="button"
              (click)="recoverWithKey()"
              [disabled]="recoveryKeyValue().length !== 64 || loading()"
              class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ (loading() ? 'auth.forgot.recovering' : 'auth.forgot.recover') | transloco }}
            </button>

            <div class="relative my-2">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-border"></div>
              </div>
              <div class="relative flex justify-center text-xs">
                <span class="bg-surface px-2 text-text-muted">{{
                  'auth.forgot.or' | transloco
                }}</span>
              </div>
            </div>

            <button
              type="button"
              (click)="skipRecovery()"
              class="w-full rounded-lg border border-ib-red/30 bg-ib-red/5 px-4 py-2.5 text-sm font-medium text-ib-red hover:bg-ib-red/10 transition-colors"
            >
              {{ 'auth.forgot.skip' | transloco }}
            </button>

            <p class="text-xs text-text-muted text-center">
              {{ 'auth.forgot.skipWarning' | transloco }}
            </p>
          </div>
        }

        @if (step() === 'done') {
          <div class="flex flex-col items-center gap-4">
            <div class="rounded-full bg-ib-green/10 p-4">
              <svg
                class="h-8 w-8 text-ib-green"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p class="text-center text-sm text-text-primary">
              {{ 'auth.forgot.doneMessage' | transloco }}
            </p>
            <a
              routerLink="/auth/login"
              class="mt-2 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-center text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              {{ 'auth.forgot.doneSignIn' | transloco }}
            </a>
          </div>
        }
      </article>

      <app-confirm-dialog />
    </main>
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthStore);
  private readonly authEncryption = inject(AuthEncryptionStore);
  private readonly confirmService = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly step = signal<'email' | 'reset' | 'recovery' | 'done'>('email');
  protected readonly pendingEmail = signal('');
  protected readonly recoveryKeyValue = signal('');

  // Conservés le temps de l'étape recovery : le reset d'un compte chiffré se fait en une seule
  // requête (code + nouveau mot de passe + clé ré-emballée), une fois la clé de récupération saisie.
  private _resetCode = '';
  private _resetPassword = '';
  private _recoveryWrappedKey = '';

  protected readonly emailForm = new FormGroup<EmailFormShape>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly resetForm = new FormGroup<ResetFormShape>(
    {
      code: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator('newPassword', 'confirmPassword')] },
  );

  protected onRecoveryKeyInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value.replace(/\s/g, '');
    this.recoveryKeyValue.set(value);
  }

  protected async submitEmail(): Promise<void> {
    if (this.emailForm.invalid) return;

    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      const { email } = this.emailForm.getRawValue();
      await this.auth.forgotPassword(email);
      this.pendingEmail.set(email);
      this.step.set('reset');
    } catch {
      this.error.set(this._i18n.translate('auth.forgot.errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submitReset(): Promise<void> {
    if (this.resetForm.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { code, newPassword } = this.resetForm.getRawValue();
      this._resetCode = code;
      this._resetPassword = newPassword;

      await this.auth.resetPassword(this.pendingEmail(), code, newPassword);
      this.forgetSecrets();
      this.step.set('done');
    } catch (e) {
      // Compte chiffré : le serveur n'a rien changé et renvoie la clé maîtresse emballée par la
      // clé de récupération. Le code reste valide pour le reset avec récupération.
      const recoveryWrappedKey = recoveryWrappedKeyFrom(e);
      if (recoveryWrappedKey !== undefined) {
        this._recoveryWrappedKey = recoveryWrappedKey;
        this.step.set('recovery');
      } else {
        this.error.set(this._i18n.translate('auth.forgot.errors.codeInvalid'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async resendCode(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.auth.forgotPassword(this.pendingEmail());
      this.success.set(this._i18n.translate('auth.forgot.success.codeResent'));
    } catch {
      this.error.set(this._i18n.translate('auth.forgot.errors.resendFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  protected backToEmail(): void {
    this.step.set('email');
    this.error.set('');
    this.success.set('');
    this.resetForm.reset();
    // Abandon du flux : le mot de passe saisi n'a plus lieu d'être conservé en mémoire.
    this.forgetSecrets();
  }

  protected async recoverWithKey(): Promise<void> {
    const recoveryHex = this.recoveryKeyValue().trim();
    if (recoveryHex.length !== 64) return;

    this.loading.set(true);
    this.error.set('');

    try {
      if (!this._recoveryWrappedKey) {
        this.error.set(this._i18n.translate('auth.forgot.errors.noRecoveryKey'));
        return;
      }

      await this.authEncryption.resetPasswordWithRecovery({
        email: this.pendingEmail(),
        code: this._resetCode,
        newPassword: this._resetPassword,
        recoveryHex,
        recoveryWrappedKey: this._recoveryWrappedKey,
      });
      this.forgetSecrets();
      this.step.set('done');
    } catch (e) {
      // Une erreur HTTP = code expiré ou refusé ; sinon la clé de récupération n'ouvre rien.
      if (isApiError(e)) {
        this.error.set(this._i18n.translate('auth.forgot.errors.codeInvalid'));
      } else {
        reportError(e, { flow: 'e2ee-recovery' });
        this.error.set(this._i18n.translate('auth.forgot.errors.invalidRecoveryKey'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async skipRecovery(): Promise<void> {
    const confirmed = await this.confirmService.confirm({
      title: this._i18n.translate('auth.forgot.skipConfirmTitle'),
      message: this._i18n.translate('auth.forgot.skipConfirm'),
      confirmLabel: this._i18n.translate('auth.forgot.skip'),
      variant: 'danger',
    });
    if (!confirmed) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.authEncryption.resetPasswordWithWipe(
        this.pendingEmail(),
        this._resetCode,
        this._resetPassword,
      );
      this.forgetSecrets();
      this.step.set('done');
    } catch {
      this.error.set(this._i18n.translate('auth.forgot.errors.wipeFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  private forgetSecrets(): void {
    this._resetCode = '';
    this._resetPassword = '';
    this._recoveryWrappedKey = '';
  }
}

function isApiError(e: unknown): e is ApiError {
  return !!e && typeof e === 'object' && typeof (e as ApiError).status === 'number';
}

/** Blob de récupération porté par le 409 `E2EE_RECOVERY_REQUIRED`, `undefined` pour toute autre erreur. */
function recoveryWrappedKeyFrom(e: unknown): string | undefined {
  if (!isApiError(e) || e.code !== 'E2EE_RECOVERY_REQUIRED') return undefined;
  const details = e.details as { recoveryWrappedKey?: unknown } | undefined;
  return typeof details?.recoveryWrappedKey === 'string' ? details.recoveryWrappedKey : '';
}
