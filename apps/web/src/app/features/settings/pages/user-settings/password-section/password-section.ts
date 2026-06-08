import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Icon } from '@shared/components/icon/icon';
import { passwordMatchValidator } from '@shared/validators/form-validators';
import { Toaster } from '@shared/components/toast/toast';

type PasswordFormShape = {
  currentPassword: FormControl<string>;
  newPassword: FormControl<string>;
  confirmPassword: FormControl<string>;
};

@Component({
  selector: 'app-password-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
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
                [attr.aria-label]="(showConfirmPassword() ? 'auth.hide' : 'auth.show') | transloco"
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
  `,
})
export class PasswordSection {
  protected readonly auth = inject(AuthStore);
  private readonly crypto = inject(CryptoStore);
  private readonly _i18n = inject(TranslocoService);
  private readonly toaster = inject(Toaster);

  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
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

  constructor() {
    effect(() => {
      if (this.auth.hasPassword()) {
        this.passwordForm.controls.currentPassword.addValidators(Validators.required);
      } else {
        this.passwordForm.controls.currentPassword.clearValidators();
      }
      this.passwordForm.controls.currentPassword.updateValueAndValidity();
    });
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

  private showFeedback(type: 'success' | 'error', message: string) {
    this.toaster[type](message);
  }
}
