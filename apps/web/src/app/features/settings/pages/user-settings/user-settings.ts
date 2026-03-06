import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../../auth/domain/auth.store';
import { Icon } from '@shared/components/icon/icon';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password === confirm ? null : { mismatch: true };
}

@Component({
  selector: 'app-user-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon, FormsModule],
  host: { class: 'block max-w-6xl w-full mx-auto pb-12' },
  template: `
    <header class="mb-8 border-b border-border pb-6">
      <h2 class="text-2xl font-bold text-text-primary tracking-tight">Paramètres du compte</h2>
      <p class="mt-2 text-sm text-text-muted">
        Gérez de manière centralisée votre profil personnel et vos paramètres de sécurité
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

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <!-- Left Column (Profile & Danger) -->
      <div class="col-span-1 lg:col-span-7 flex flex-col gap-8">
        <!-- Profile -->
        <section
          aria-labelledby="profile-heading"
          class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden"
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
                <div class="pt-2 flex justify-end">
                  <button
                    type="submit"
                    [disabled]="profileForm.pristine || profileSaving()"
                    class="inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5"
                    style="background-color: var(--color-ib-blue)"
                  >
                    {{ profileSaving() ? 'Enregistrement...' : 'Enregistrer' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        <!-- Danger zone -->
        <section
          aria-labelledby="danger-heading"
          class="rounded-2xl border border-ib-red/20 bg-ib-red/2 shadow-sm overflow-hidden mt-auto"
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
                class="flex-1 rounded-lg border border-ib-red/30 bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors focus:border-ib-red focus:outline-none focus:ring-1 focus:ring-ib-red placeholder:text-text-muted/50"
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

      <!-- Right Column (Security) -->
      <div class="col-span-1 lg:col-span-5 flex flex-col gap-8">
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
              Mettez à jour votre mot de passe de connexion.
            </p>
          </div>

          <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="p-6 space-y-5">
            <div class="space-y-1.5">
              <label for="new-password" class="text-sm font-medium text-text-primary">
                Nouveau mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
              </label>
              <input
                id="new-password"
                type="password"
                formControlName="newPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
              />
              @if (
                passwordForm.controls.newPassword.touched &&
                passwordForm.controls.newPassword.errors?.['minlength']
              ) {
                <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                  Le mot de passe doit contenir au moins 8 caractères.
                </p>
              }
            </div>

            <div class="space-y-1.5">
              <label for="confirm-password" class="text-sm font-medium text-text-primary">
                Confirmer le mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
              </label>
              <input
                id="confirm-password"
                type="password"
                formControlName="confirmPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm transition-colors focus:border-ib-blue focus:outline-none focus:ring-1 focus:ring-ib-blue"
              />
              @if (
                passwordForm.controls.confirmPassword.touched && passwordForm.errors?.['mismatch']
              ) {
                <p class="text-xs text-ib-red font-medium mt-1" role="alert">
                  Les mots de passe ne correspondent pas.
                </p>
              }
            </div>

            <div class="pt-2">
              <button
                type="submit"
                [disabled]="passwordForm.invalid || passwordSaving()"
                class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md hover:-translate-y-0.5"
                style="background-color: var(--color-ib-blue)"
              >
                {{ passwordSaving() ? 'Modification...' : 'Mettre à jour' }}
              </button>
            </div>
          </form>
        </section>

        <!-- 2FA -->
        <section
          aria-labelledby="2fa-heading"
          class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden flex-1"
        >
          <div
            class="px-6 py-5 border-b border-border bg-surface/50 flex items-center justify-between"
          >
            <div>
              <h3 id="2fa-heading" class="text-base font-semibold text-text-primary">
                Sécurité 2FA
              </h3>
            </div>
            @if (mfaEnabled()) {
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-ib-green/10 text-ib-green border border-ib-green/20"
                >Active</span
              >
            } @else {
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-raised text-text-muted border border-border"
                >Inactive</span
              >
            }
          </div>

          <div class="p-6 h-full flex flex-col justify-center">
            @if (mfaEnabled()) {
              <div class="flex flex-col items-center text-center space-y-4">
                <p class="text-sm text-text-primary">
                  L'authentification à double facteur est activée sur votre compte.
                </p>
                <button
                  type="button"
                  (click)="disableMfa()"
                  class="w-full inline-flex items-center justify-center rounded-lg border border-ib-red/30 bg-surface px-5 py-2.5 text-sm font-medium text-ib-red hover:bg-ib-red/5 hover:border-ib-red/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                >
                  Désactiver
                </button>
              </div>
            } @else if (mfaQrCode()) {
              <div class="space-y-5">
                <div
                  class="bg-ib-blue/5 border border-ib-blue/20 rounded-xl p-4 text-sm text-text-primary text-center"
                >
                  Scannez ce QR code avec Google Authenticator ou Authy
                </div>

                <div
                  class="flex justify-center p-3 bg-white rounded-xl w-fit mx-auto border border-border shadow-sm"
                >
                  <img [src]="mfaQrCode()" alt="QR Code 2FA" class="w-40 h-40" />
                </div>

                @if (mfaSecret()) {
                  <div class="text-center space-y-1.5">
                    <code
                      class="block text-sm font-mono text-ib-cyan bg-raised px-4 py-2 border border-border rounded-lg select-all"
                      >{{ mfaSecret() }}</code
                    >
                  </div>
                }

                <form (ngSubmit)="verifyMfa()" class="space-y-4 border-t border-border pt-5">
                  <div class="space-y-1.5">
                    <label
                      for="mfa-code"
                      class="text-sm font-medium text-text-primary text-center block"
                      >Code de vérification</label
                    >
                    <input
                      #mfaCodeInput
                      id="mfa-code"
                      type="text"
                      inputmode="numeric"
                      pattern="[0-9]{6}"
                      maxlength="6"
                      class="w-full rounded-lg border border-border bg-surface px-4 py-3 text-center text-xl tracking-[0.5em] font-mono transition-colors focus:border-ib-green focus:outline-none focus:ring-1 focus:ring-ib-green"
                      placeholder="000000"
                    />
                  </div>
                  <div class="flex gap-3">
                    <button
                      type="button"
                      (click)="cancelMfaEnroll()"
                      class="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-primary hover:bg-raised transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      [disabled]="mfaVerifying()"
                      class="flex-1 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 hover:shadow-md"
                      style="background-color: var(--color-ib-green)"
                    >
                      Activer
                    </button>
                  </div>
                </form>
              </div>
            } @else {
              <div class="flex flex-col items-center text-center space-y-4">
                <p class="text-sm text-text-muted">
                  Renforcez la sécurité de votre compte avec une étape de vérification
                  supplémentaire lors de la connexion.
                </p>
                <button
                  type="button"
                  (click)="startMfaEnroll()"
                  [disabled]="mfaEnrolling()"
                  class="w-full inline-flex items-center justify-center rounded-lg px-6 py-2.5 text-sm font-medium text-white transition-all hover:shadow-md hover:-translate-y-0.5"
                  style="background-color: var(--color-ib-green)"
                >
                  {{ mfaEnrolling() ? 'Préparation...' : 'Configurer la 2FA' }}
                </button>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
})
export class UserSettings {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  private readonly mfaCodeRef = viewChild<ElementRef<HTMLInputElement>>('mfaCodeInput');

  // Feedback
  protected readonly feedback = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // Profile
  protected readonly avatarPreview = signal<string | null>(null);
  protected readonly profileSaving = signal(false);
  protected readonly profileForm = new FormGroup({
    displayName: new FormControl('', { nonNullable: true }),
  });

  // Password
  protected readonly passwordSaving = signal(false);
  protected readonly passwordForm = new FormGroup(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator] },
  );

  // MFA
  protected readonly mfaEnabled = signal(false);
  protected readonly mfaFactorId = signal<string | null>(null);
  protected readonly mfaEnrolling = signal(false);
  protected readonly mfaQrCode = signal<string | null>(null);
  protected readonly mfaSecret = signal<string | null>(null);
  protected readonly mfaPendingFactorId = signal<string | null>(null);
  protected readonly mfaVerifying = signal(false);

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

    this.loadMfaStatus();
  }

  private async loadMfaStatus() {
    try {
      const factors = await this.auth.getMfaFactors();
      const verified = factors.find((f: { status: string }) => f.status === 'verified');
      this.mfaEnabled.set(!!verified);
      this.mfaFactorId.set(verified?.id ?? null);
    } catch {
      // MFA not available
    }
  }

  protected async onAvatarSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => this.avatarPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    try {
      await this.auth.uploadAvatar(file);
      this.showFeedback('success', 'Avatar mis à jour avec succès.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Erreur lors du téléversement de l'avatar.";
      this.showFeedback('error', message);
      this.avatarPreview.set(null);
    }
  }

  protected async saveProfile() {
    if (this.profileForm.invalid) return;
    this.profileSaving.set(true);
    try {
      await this.auth.updateProfile({ display_name: this.profileForm.getRawValue().displayName });
      this.showFeedback('success', 'Profil mis à jour avec succès.');
      this.profileForm.markAsPristine();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour du profil.';
      this.showFeedback('error', message);
    } finally {
      this.profileSaving.set(false);
    }
  }

  protected async changePassword() {
    if (this.passwordForm.invalid) return;
    this.passwordSaving.set(true);
    try {
      await this.auth.updatePassword(this.passwordForm.getRawValue().newPassword);
      this.showFeedback('success', 'Mot de passe modifié avec succès.');
      this.passwordForm.reset();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la modification du mot de passe.';
      this.showFeedback('error', message);
    } finally {
      this.passwordSaving.set(false);
    }
  }

  protected async startMfaEnroll() {
    this.mfaEnrolling.set(true);
    try {
      const { id, qrCode, secret } = await this.auth.enrollTotp();
      this.mfaPendingFactorId.set(id);
      this.mfaQrCode.set(qrCode);
      this.mfaSecret.set(secret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'activation de la 2FA.";
      this.showFeedback('error', message);
    } finally {
      this.mfaEnrolling.set(false);
    }
  }

  protected async verifyMfa() {
    const factorId = this.mfaPendingFactorId();
    const codeInput = this.mfaCodeRef()?.nativeElement;
    if (!factorId || !codeInput) return;
    const code = codeInput.value.trim();
    if (code.length !== 6) return;

    this.mfaVerifying.set(true);
    try {
      await this.auth.verifyTotp(factorId, code);
      this.mfaEnabled.set(true);
      this.mfaFactorId.set(factorId);
      this.mfaQrCode.set(null);
      this.mfaSecret.set(null);
      this.mfaPendingFactorId.set(null);
      this.showFeedback('success', 'Authentification à double facteur activée.');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Code invalide. Veuillez réessayer.';
      this.showFeedback('error', message);
    } finally {
      this.mfaVerifying.set(false);
    }
  }

  protected cancelMfaEnroll() {
    this.mfaQrCode.set(null);
    this.mfaSecret.set(null);
    this.mfaPendingFactorId.set(null);
  }

  protected async disableMfa() {
    const factorId = this.mfaFactorId();
    if (!factorId) return;
    if (!confirm("Désactiver l'authentification à double facteur ?")) return;

    try {
      await this.auth.unenrollTotp(factorId);
      this.mfaEnabled.set(false);
      this.mfaFactorId.set(null);
      this.showFeedback('success', 'Authentification à double facteur désactivée.');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la désactivation de la 2FA.';
      this.showFeedback('error', message);
    }
  }

  protected async deleteAccount() {
    if (this.deleteConfirmValue() !== this.auth.email()) return;
    if (
      !confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.')
    )
      return;

    this.deleting.set(true);
    try {
      await this.auth.deleteAccount();
      this.router.navigate(['/auth/login']);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la suppression du compte.';
      this.showFeedback('error', message);
      this.deleting.set(false);
    }
  }

  private showFeedback(type: 'success' | 'error', message: string) {
    this.feedback.set({ type, message });
    setTimeout(() => this.feedback.set(null), 5000);
  }
}
