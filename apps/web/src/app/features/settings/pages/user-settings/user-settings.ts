import { ChangeDetectionStrategy, Component, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../../auth/domain/auth.store';
import { CryptoStore } from '@core/services/crypto/crypto.store';
import { Icon } from '@shared/components/icon/icon';
import { RecoveryKeyModal } from '../../../auth/components/recovery-key-modal/recovery-key-modal';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { passwordMatchValidator } from '@shared/validators/form-validators';

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
  imports: [ReactiveFormsModule, Icon, RecoveryKeyModal],
  host: { class: 'block w-full h-full overflow-y-auto' },
  template: `
    <div class="max-w-5xl mx-auto p-6 pb-12">
    <header class="mb-8 border-b border-border pb-6">
      <h2 class="text-2xl font-bold text-text-primary tracking-tight">Paramètres du compte</h2>
      <p class="mt-2 text-sm text-text-muted">
        Gérez votre profil personnel et vos paramètres de sécurité
      </p>
    </header>

    @if (feedback(); as msg) {
      <div
        role="alert"
        class="rounded-xl border p-4 text-sm mb-8 flex items-center gap-3 shadow-sm transition-all"
        [class.border-ib-green-30]="msg.type === 'success'"
        [class.bg-ib-green-10]="msg.type === 'success'"
        [class.text-ib-green]="msg.type === 'success'"
        [class.border-ib-red-30]="msg.type === 'error'"
        [class.bg-ib-red-10]="msg.type === 'error'"
        [class.text-ib-red]="msg.type === 'error'"
      >
        <span class="font-medium">{{ msg.message }}</span>
      </div>
    }

    <!-- ── Profile ── -->
    <section
      aria-labelledby="profile-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <h3 id="profile-heading" class="text-base font-semibold text-text-primary">
          Profil personnel
        </h3>
        <p class="text-sm text-text-muted mt-1">Mettez à jour vos informations publiques.</p>
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
                <img
                  [src]="avatarPreview() || auth.avatarUrl()"
                  alt="Avatar"
                  class="w-24 h-24 rounded-full object-cover border-4 border-surface shadow-sm"
                />
              } @else {
                <div
                  class="w-24 h-24 rounded-full bg-linear-to-br from-ib-purple to-ib-blue flex items-center justify-center text-3xl font-bold text-white shadow-sm border-4 border-surface"
                >
                  {{ auth.userInitial() }}
                </div>
              }
              <div
                class="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-[2px]"
              >
                <app-icon name="camera" size="28" class="text-white" />
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
            <legend class="sr-only">Profil personnel</legend>
            <div class="space-y-1.5">
              <label for="display-name" class="text-sm font-medium text-text-primary"
                >Nom d'affichage</label
              >
              <input
                id="display-name"
                type="text"
                formControlName="displayName"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
              />
            </div>
            <div class="space-y-1.5">
              <label for="user-email" class="text-sm font-medium text-text-primary"
                >Adresse e-mail</label
              >
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
                class="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
              >
                {{ profileSaving() ? 'Enregistrement...' : 'Enregistrer' }}
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
            Mot de passe
          </h3>
          <p class="text-sm text-text-muted mt-1">
            @if (auth.hasPassword()) {
              Mettez à jour votre mot de passe de connexion.
            } @else {
              Définissez un mot de passe pour vous connecter sans Google.
            }
          </p>
        </div>

        <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="p-6 space-y-5">
          <fieldset class="space-y-5">
          <legend class="sr-only">{{ auth.hasPassword() ? 'Modifier le mot de passe' : 'Définir un mot de passe' }}</legend>

          @if (auth.hasPassword()) {
          <div class="space-y-1.5">
            <label for="current-password" class="text-sm font-medium text-text-primary">
              Mot de passe actuel <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                id="current-password"
                [type]="showCurrentPassword() ? 'text' : 'password'"
                formControlName="currentPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
              />
              <button type="button" (click)="showCurrentPassword.set(!showCurrentPassword())"
                class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showCurrentPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showCurrentPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (passwordForm.controls.currentPassword.touched && passwordForm.controls.currentPassword.errors?.['required']) {
              <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                Le mot de passe actuel est obligatoire.
              </p>
            }
          </div>
          }

          <div class="space-y-1.5">
            <label for="new-password" class="text-sm font-medium text-text-primary">
              {{ auth.hasPassword() ? 'Nouveau mot de passe' : 'Mot de passe' }} <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                id="new-password"
                [type]="showNewPassword() ? 'text' : 'password'"
                formControlName="newPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
              />
              <button type="button" (click)="showNewPassword.set(!showNewPassword())"
                class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showNewPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showNewPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (passwordForm.controls.newPassword.touched) {
              @if (passwordForm.controls.newPassword.errors?.['required']) {
                <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                  Le mot de passe est obligatoire.
                </p>
              } @else if (passwordForm.controls.newPassword.errors?.['minlength']) {
                <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                  Le mot de passe doit contenir au moins 12 caractères.
                </p>
              }
            }
          </div>

          <div class="space-y-1.5">
            <label for="confirm-password" class="text-sm font-medium text-text-primary">
              Confirmer le mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                id="confirm-password"
                [type]="showConfirmPassword() ? 'text' : 'password'"
                formControlName="confirmPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
              />
              <button type="button" (click)="showConfirmPassword.set(!showConfirmPassword())"
                class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showConfirmPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showConfirmPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (
              (passwordForm.controls.newPassword.touched || passwordForm.controls.confirmPassword.touched) &&
              passwordForm.errors?.['mismatch']
            ) {
              <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                Les mots de passe ne correspondent pas.
              </p>
            }
          </div>
          </fieldset>

          <div class="pt-2">
            <button
              type="submit"
              [disabled]="passwordForm.invalid || passwordSaving()"
              class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
            >
              @if (passwordSaving()) {
                {{ auth.hasPassword() ? 'Modification...' : 'Définition...' }}
              } @else {
                {{ auth.hasPassword() ? 'Mettre à jour' : 'Définir le mot de passe' }}
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
                Authentification à deux facteurs
              </h3>
              <p class="text-sm text-text-muted mt-1">
                Protégez votre compte avec une application TOTP.
              </p>
            </div>
            @if (auth.totpEnabled()) {
              <span class="inline-flex items-center gap-1.5 rounded-full bg-ib-green/10 px-3 py-1 text-xs font-semibold text-ib-green border border-ib-green/20">
                Activé
              </span>
            }
          </div>
        </div>

        <div class="p-6">
          @if (auth.totpEnabled()) {
            <!-- 2FA is enabled — show disable option -->
            <div class="space-y-4">
              <p class="text-sm text-text-primary">
                La 2FA est activée sur votre compte. Pour la désactiver, entrez votre mot de passe.
              </p>
              <div class="space-y-1.5">
                <label for="disable-2fa-password" class="text-sm font-medium text-text-primary">
                  Mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
                </label>
                <div class="relative">
                  <input
                    #disable2faInput
                    id="disable-2fa-password"
                    [type]="showDisable2faPassword() ? 'text' : 'password'"
                    (input)="disablePassword.set(disable2faInput.value)"
                    class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 pr-10 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
                  />
                  <button type="button" (click)="showDisable2faPassword.set(!showDisable2faPassword())"
                    class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                    [attr.aria-label]="showDisable2faPassword() ? 'Masquer' : 'Afficher'">
                    <app-icon [name]="showDisable2faPassword() ? 'eye-off' : 'eye'" size="18" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                (click)="disable2FA()"
                [disabled]="!disablePassword() || totpLoading()"
                class="w-full inline-flex items-center justify-center rounded-lg border border-ib-red/30 bg-ib-red/5 px-6 py-2.5 text-sm font-medium text-ib-red transition-all hover:bg-ib-red/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ totpLoading() ? 'Désactivation...' : 'Désactiver la 2FA' }}
              </button>
            </div>
          } @else if (totpSetup()) {
            <!-- Setup in progress — show QR + verify -->
            <div class="space-y-5">
              <p class="text-sm text-text-primary">
                Scannez ce QR code avec votre application d'authentification
                (Google Authenticator, Authy, etc.)
              </p>

              <div class="flex justify-center">
                <img
                  [src]="totpSetup()!.qrCode"
                  alt="QR code 2FA"
                  class="w-48 h-48 rounded-lg border border-border bg-white p-2"
                />
              </div>

              <details class="text-sm">
                <summary class="cursor-pointer text-text-muted hover:text-text-primary transition-colors">
                  Cle manuelle
                </summary>
                <code class="mt-2 block rounded-lg bg-canvas p-3 text-xs font-mono text-text-primary break-all select-all border border-border">
                  {{ totpSetup()!.secret }}
                </code>
              </details>

              <div class="space-y-1.5">
                <label for="verify-totp" class="text-sm font-medium text-text-primary">
                  Code de vérification <span aria-hidden="true" class="text-ib-red">*</span>
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
                  Annuler
                </button>
                <button
                  type="button"
                  (click)="verify2FA()"
                  [disabled]="totpVerifyCode().length !== 6 || totpLoading()"
                  class="flex-1 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
                >
                  {{ totpLoading() ? 'Vérification...' : 'Activer' }}
                </button>
              </div>
            </div>
          } @else {
            <!-- 2FA not enabled — show setup button -->
            <div class="space-y-4">
              <p class="text-sm text-text-muted">
                Ajoutez une couche de sécurité supplémentaire en activant l'authentification à deux facteurs.
                Vous aurez besoin d'une application comme Google Authenticator ou Authy.
              </p>
              <button
                type="button"
                (click)="setup2FA()"
                [disabled]="totpLoading()"
                class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
              >
                {{ totpLoading() ? 'Configuration...' : 'Configurer la 2FA' }}
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
              Chiffrement de bout en bout
            </h3>
            <p class="text-sm text-text-muted mt-1">
              Vos données sont chiffrées localement avant d'être envoyées au serveur.
            </p>
          </div>
          @if (auth.encryptionVersion() === 1) {
            <span class="inline-flex items-center gap-1.5 rounded-full bg-ib-green/10 px-3 py-1 text-xs font-semibold text-ib-green border border-ib-green/20">
              Actif
            </span>
          } @else {
            <span class="inline-flex items-center gap-1.5 rounded-full bg-ib-amber/10 px-3 py-1 text-xs font-semibold text-ib-amber border border-ib-amber/20">
              Non configuré
            </span>
          }
        </div>
      </div>

      <div class="p-6 space-y-4">
        @if (auth.encryptionVersion() === 0) {
          <p class="text-sm text-text-muted">
            Le chiffrement n'est pas encore activé. Activez-le pour protéger vos données.
          </p>
          <button
            type="button"
            (click)="goToEncryptionSetup()"
            class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-md hover:-translate-y-0.5 bg-ib-blue"
          >
            Activer le chiffrement
          </button>
        } @else {
          <div class="flex items-center gap-3 text-sm text-text-primary">
            <div class="flex h-8 w-8 items-center justify-center rounded-full bg-ib-green/10">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                   class="text-ib-green" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </svg>
            </div>
            Vos données sont protégées par un chiffrement AES-256-GCM.
          </div>

          <button
            type="button"
            (click)="regenerateRecoveryKey()"
            [disabled]="encryptionLoading()"
            class="w-full inline-flex items-center justify-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-raised disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ encryptionLoading() ? 'Génération...' : 'Régénérer la clé de récupération' }}
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
          Zone de danger
        </h3>
      </div>
      <div class="p-6">
        <p class="text-sm text-text-primary font-medium mb-1">
          Supprimer le compte de façon définitive
        </p>
        <p class="text-sm text-text-muted mb-5">
          Cette action est irréversible. Toutes vos données seront définitivement supprimées.
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
            class="inline-flex shrink-0 items-center justify-center rounded-lg bg-ib-red px-6 py-2.5 text-sm font-medium text-white hover:bg-ib-red/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red focus-visible:ring-offset-2"
          >
            {{ deleting() ? 'Suppression...' : 'Supprimer' }}
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

  // Feedback
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

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
      this.showFeedback('success', 'Avatar mis à jour.');
    } catch {
      this.avatarPreview.set(null);
      this.showFeedback('error', "Erreur lors de l'upload de l'avatar.");
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected async saveProfile() {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);
    try {
      await this.auth.updateProfile({ displayName: this.profileForm.getRawValue().displayName });
      this.showFeedback('success', 'Profil mis à jour avec succès.');
      this.profileForm.markAsPristine();
    } catch {
      this.showFeedback('error', 'Erreur lors de la mise à jour du profil.');
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
        this.showFeedback('success', 'Mot de passe défini avec succès. Vous pouvez maintenant vous connecter avec email + mot de passe.');
        this.passwordForm.controls.currentPassword.addValidators(Validators.required);
        this.passwordForm.controls.currentPassword.updateValueAndValidity();
      } else if (this.auth.encryptionVersion() === 1 && this.crypto.isUnlocked()) {
        await this.auth.updatePasswordWithReWrap(currentPassword, newPassword);
        this.showFeedback('success', 'Mot de passe modifié avec succès.');
      } else {
        await this.auth.updatePassword(currentPassword, newPassword);
        this.showFeedback('success', 'Mot de passe modifié avec succès.');
      }
      this.passwordForm.reset();
    } catch {
      this.showFeedback('error', this.auth.hasPassword()
        ? 'Erreur lors de la modification du mot de passe.'
        : 'Erreur lors de la définition du mot de passe.');
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
      this.showFeedback('error', 'Erreur lors de la configuration de la 2FA.');
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
      this.showFeedback('success', 'Authentification à deux facteurs activée.');
    } catch {
      this.showFeedback('error', 'Code invalide. Réessayez.');
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
      this.showFeedback('success', 'Authentification à deux facteurs désactivée.');
    } catch {
      this.showFeedback('error', 'Mot de passe incorrect.');
    } finally {
      this.totpLoading.set(false);
    }
  }

  // ── Delete ──

  protected async deleteAccount() {
    if (this.deleteConfirmValue() !== this.auth.email()) return;

    const confirmed = await this.confirm.confirm({
      title: 'Supprimer votre compte',
      message: 'Cette action est définitive et irréversible. Toutes vos données, y compris vos données chiffrées, seront définitivement supprimées. Aucune récupération ne sera possible.',
      confirmLabel: 'Supprimer mon compte',
      cancelLabel: 'Annuler',
      variant: 'danger',
    });
    if (!confirmed) return;

    this.deleting.set(true);
    try {
      await this.auth.deleteAccount();
      this.router.navigate(['/auth/login']);
    } catch {
      this.showFeedback('error', 'Erreur lors de la suppression du compte.');
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
        this.showFeedback('error', 'Vos données ne sont pas déverrouillées.');
        return;
      }

      const recoveryKey = this.crypto.generateRecoveryKey();
      const recoveryWrappingKey = await this.crypto.deriveWrappingKeyFromRecovery(recoveryKey);
      await this.crypto.wrapKey(masterKey, recoveryWrappingKey);

      this.settingsRecoveryKey.set(recoveryKey);
      this.recoveryModal()?.open();
    } catch {
      this.showFeedback('error', 'Erreur lors de la régénération de la clé.');
    } finally {
      this.encryptionLoading.set(false);
    }
  }

  protected onRecoveryKeyRegenerated(): void {
    this.showFeedback('success', 'Clé de récupération régénérée avec succès.');
  }

  private showFeedback(type: 'success' | 'error', message: string) {
    this.feedback.set({ type, message });
    setTimeout(() => this.feedback.set(null), 5000);
  }
}
