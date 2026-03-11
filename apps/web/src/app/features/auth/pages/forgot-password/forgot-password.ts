import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClient } from '@core/services/api/api-client';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { AuthStore } from '../../domain/auth.store';
import { Icon } from '@shared/components/icon/icon';
import { firstValueFrom } from 'rxjs';

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
  imports: [ReactiveFormsModule, RouterLink, Icon],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <article class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
      <header class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-text-primary">DashFlow</h1>
        <p class="mt-2 text-sm text-text-muted">Reinitialisation du mot de passe</p>
      </header>

      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
      }

      @if (success()) {
        <div class="mb-4 rounded-md bg-ib-green/10 p-3 text-sm text-ib-green">{{ success() }}</div>
      }

      @if (step() === 'email') {
        <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="flex flex-col gap-4">
          <div>
            <label for="email" class="mb-1.5 block text-sm font-medium text-text-primary">
              Email <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              type="email"
              id="email"
              formControlName="email"
              aria-required="true"
              class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              placeholder="vous@exemple.com"
            />
            @if (emailForm.controls.email.touched) {
              @if (emailForm.controls.email.errors?.['required']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">L'email est obligatoire.</small>
              } @else if (emailForm.controls.email.errors?.['email']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">L'email doit avoir un format valide.</small>
              }
            }
          </div>

          <button
            type="submit"
            [disabled]="emailForm.invalid || loading()"
            class="mt-2 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading() ? 'Envoi...' : 'Envoyer le code' }}
          </button>

          <p class="mt-4 text-center text-sm text-text-muted">
            <a routerLink="/auth/login" class="font-medium text-ib-blue hover:underline">Retour a la connexion</a>
          </p>
        </form>
      }

      @if (step() === 'reset') {
        <div class="mb-4 rounded-lg bg-ib-blue/5 border border-ib-blue/20 p-4 text-center">
          <p class="text-sm text-text-primary">
            Un code a ete envoye a <strong>{{ pendingEmail() }}</strong>
          </p>
        </div>

        <form [formGroup]="resetForm" (ngSubmit)="submitReset()" class="flex flex-col gap-4">
          <div>
            <label for="code" class="mb-1.5 block text-sm font-medium text-text-primary text-center">
              Code de reinitialisation
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
              Nouveau mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showNewPassword() ? 'text' : 'password'"
                id="newPassword"
                formControlName="newPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="••••••••"
              />
              <button type="button" (click)="showNewPassword.set(!showNewPassword())"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showNewPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showNewPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (resetForm.controls.newPassword.touched && resetForm.controls.newPassword.errors?.['minlength']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">Le mot de passe doit faire au minimum 6 caracteres.</small>
            }
          </div>

          <div>
            <label for="confirmPassword" class="mb-1.5 block text-sm font-medium text-text-primary">
              Confirmer le mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showConfirmPassword() ? 'text' : 'password'"
                id="confirmPassword"
                formControlName="confirmPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="••••••••"
              />
              <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showConfirmPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showConfirmPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (resetForm.controls.confirmPassword.touched && passwordMismatch()) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">Les mots de passe ne correspondent pas.</small>
            }
          </div>

          <button
            type="submit"
            [disabled]="resetForm.invalid || passwordMismatch() || loading()"
            class="mt-2 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading() ? 'Reinitialisation...' : 'Reinitialiser le mot de passe' }}
          </button>

          <div class="mt-2 flex justify-between text-sm">
            <button
              type="button"
              (click)="resendCode()"
              [disabled]="loading()"
              class="text-text-muted hover:text-text-primary transition-colors"
            >
              Renvoyer le code
            </button>
            <button
              type="button"
              (click)="backToEmail()"
              class="text-text-muted hover:text-text-primary transition-colors"
            >
              Modifier l'email
            </button>
          </div>
        </form>
      }

      @if (step() === 'recovery') {
        <div class="flex flex-col gap-4">
          <div class="rounded-lg bg-ib-amber/10 border border-ib-amber/20 p-4">
            <p class="text-sm font-medium text-ib-amber">Donnees chiffrees detectees</p>
            <p class="mt-1 text-sm text-text-primary">
              Vos donnees etaient chiffrees. Avez-vous votre cle de recuperation ?
            </p>
          </div>

          <div>
            <label for="recoveryKey" class="mb-1.5 block text-sm font-medium text-text-primary">
              Cle de recuperation (64 caracteres hex)
            </label>
            <textarea
              id="recoveryKey"
              rows="3"
              class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              placeholder="Collez votre cle de recuperation ici..."
              (input)="onRecoveryKeyInput($event)"
            ></textarea>
          </div>

          <button
            type="button"
            (click)="recoverWithKey()"
            [disabled]="recoveryKeyValue().length !== 64 || loading()"
            class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading() ? 'Recuperation...' : 'Recuperer mes donnees' }}
          </button>

          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-border"></div></div>
            <div class="relative flex justify-center text-xs"><span class="bg-surface px-2 text-text-muted">ou</span></div>
          </div>

          <button
            type="button"
            (click)="skipRecovery()"
            class="w-full rounded-lg border border-ib-red/30 bg-ib-red/5 px-4 py-2.5 text-sm font-medium text-ib-red hover:bg-ib-red/10 transition-colors"
          >
            Continuer sans cle (donnees perdues)
          </button>

          <p class="text-xs text-text-muted text-center">
            Sans cle de recuperation, toutes vos donnees chiffrees seront definitivement perdues.
          </p>
        </div>
      }

      @if (step() === 'done') {
        <div class="flex flex-col items-center gap-4">
          <div class="rounded-full bg-ib-green/10 p-4">
            <svg class="h-8 w-8 text-ib-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p class="text-center text-sm text-text-primary">
            Votre mot de passe a ete reinitialise avec succes.
          </p>
          <a
            routerLink="/auth/login"
            class="mt-2 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          >
            Se connecter
          </a>
        </div>
      }
    </article>
  `
})
export class ForgotPassword {
  private readonly auth = inject(AuthStore);
  private readonly cryptoStore = inject(CryptoStore);
  private readonly api = inject(ApiClient);

  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly step = signal<'email' | 'reset' | 'recovery' | 'done'>('email');
  protected readonly pendingEmail = signal('');
  protected readonly recoveryKeyValue = signal('');

  private _resetPassword = '';
  private _resetCode = '';

  protected readonly emailForm = new FormGroup<EmailFormShape>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
  });

  protected readonly resetForm = new FormGroup<ResetFormShape>({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
    }),
    newPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected onRecoveryKeyInput(event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value.replace(/\s/g, '');
    this.recoveryKeyValue.set(value);
  }

  protected passwordMismatch(): boolean {
    const { newPassword, confirmPassword } = this.resetForm.getRawValue();
    return confirmPassword.length > 0 && newPassword !== confirmPassword;
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
      this.error.set('Une erreur est survenue. Veuillez reessayer.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async submitReset(): Promise<void> {
    if (this.resetForm.invalid || this.passwordMismatch()) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { code, newPassword } = this.resetForm.getRawValue();
      this._resetPassword = newPassword;
      this._resetCode = code;

      // Reset password on server
      await this.auth.resetPassword(this.pendingEmail(), code, newPassword);

      // Check if user had encryption — if so, show recovery step
      // After password reset, log in to check encryption state
      try {
        await this.auth.login(this.pendingEmail(), newPassword);
        const user = this.auth.user();
        if (user && user.encryptionVersion === 1) {
          this.step.set('recovery');
        } else {
          await this.auth.logout();
          this.step.set('done');
        }
      } catch {
        // Login might fail (2FA etc), just go to done
        this.step.set('done');
      }
    } catch {
      this.error.set('Code invalide ou expire. Veuillez reessayer.');
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
      this.success.set('Un nouveau code a ete envoye.');
    } catch {
      this.error.set('Erreur lors du renvoi du code.');
    } finally {
      this.loading.set(false);
    }
  }

  protected backToEmail(): void {
    this.step.set('email');
    this.error.set('');
    this.success.set('');
    this.resetForm.reset();
  }

  protected async recoverWithKey(): Promise<void> {
    const recoveryHex = this.recoveryKeyValue().trim();
    if (recoveryHex.length !== 64) return;

    this.loading.set(true);
    this.error.set('');

    try {
      // Get the recovery-wrapped key from server
      const keyMaterial = this.auth.getKeyMaterial();
      if (!keyMaterial?.recoveryWrappedKey) {
        this.error.set('Aucune cle de recuperation trouvee sur le serveur.');
        return;
      }

      // Unwrap master key with recovery key
      await this.cryptoStore.unlockWithRecovery(recoveryHex, keyMaterial.recoveryWrappedKey);

      // Re-wrap with new password
      const masterKey = this.cryptoStore.getMasterKey()!;
      const salt = this.cryptoStore.generateSalt();
      const wrappingKey = await this.cryptoStore.deriveWrappingKey(this._resetPassword, salt);
      const wrappedMasterKey = await this.cryptoStore.wrapKey(masterKey, wrappingKey);
      const { bytesToHex } = await import('@core/services/crypto/crypto.store');
      const saltHex = bytesToHex(salt);

      // Also re-wrap with recovery key for future use
      const recoveryWrappingKey = await this.cryptoStore.deriveWrappingKeyFromRecovery(recoveryHex);
      const recoveryWrappedKey = await this.cryptoStore.wrapKey(masterKey, recoveryWrappingKey);

      // Save new key material on server
      await firstValueFrom(
        this.api.patch('/auth/me/encryption-keys', {
          salt: saltHex,
          wrappedMasterKey,
          recoveryWrappedKey,
        }),
      );

      await this.auth.logout();
      this.step.set('done');
    } catch {
      this.error.set('Cle de recuperation invalide.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async skipRecovery(): Promise<void> {
    if (!confirm('Etes-vous sur ? Toutes vos donnees chiffrees seront definitivement perdues.')) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await firstValueFrom(this.api.post('/auth/me/wipe-encryption', {}));
      await this.auth.logout();
      this.step.set('done');
    } catch {
      this.error.set('Erreur lors de la suppression des donnees.');
    } finally {
      this.loading.set(false);
    }
  }
}
