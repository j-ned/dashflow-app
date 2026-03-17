import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../domain/auth.store';
import { Icon } from '@shared/components/icon/icon';
import { passwordMatchValidator } from '@shared/validators/form-validators';

type RegisterFormShape = {
  displayName: FormControl<string>;
  email: FormControl<string>;
  password: FormControl<string>;
  confirmPassword: FormControl<string>;
};

@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <main>
    <article class="w-full max-w-xl rounded-xl border border-border bg-surface p-10 shadow-lg">
      <header class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-text-primary">DashFlow</h1>
        <p class="mt-2 text-sm text-text-muted">Créez votre compte</p>
      </header>

      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
      }

      @if (success()) {
        <p role="status" class="mb-4 rounded-md bg-ib-green/10 p-3 text-sm text-ib-green">{{ success() }}</p>
      }

      @if (step() === 'register') {
        <form [formGroup]="registerForm" (ngSubmit)="submitRegister()" class="flex flex-col gap-4">
          <fieldset class="flex flex-col gap-4">
          <legend class="sr-only">Informations d'inscription</legend>
          <div>
            <label for="displayName" class="mb-1.5 block text-sm font-medium text-text-primary">
              Nom d'affichage
            </label>
            <input
              type="text"
              id="displayName"
              formControlName="displayName"
              class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              placeholder="Jean Dupont"
            />
          </div>

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
            @if (registerForm.controls.email.touched) {
              @if (registerForm.controls.email.errors?.['required']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">L'email est obligatoire.</small>
              } @else if (registerForm.controls.email.errors?.['email']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">L'email doit avoir un format valide.</small>
              }
            }
          </div>

          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-text-primary">
              Mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                id="password"
                formControlName="password"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="••••••••"
              />
              <button type="button" (click)="showPassword.set(!showPassword())"
                class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (registerForm.controls.password.touched) {
              @if (registerForm.controls.password.errors?.['required']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">Le mot de passe est obligatoire.</small>
              } @else if (registerForm.controls.password.errors?.['minlength']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">Le mot de passe doit faire au moins 12 caractères.</small>
              }
            }
          </div>

          <div>
            <label for="confirmPassword" class="mb-1.5 block text-sm font-medium text-text-primary">
              Confirmer le mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showConfirm() ? 'text' : 'password'"
                id="confirmPassword"
                formControlName="confirmPassword"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="••••••••"
              />
              <button type="button" (click)="showConfirm.set(!showConfirm())"
                class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showConfirm() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showConfirm() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (registerForm.controls.confirmPassword.touched && registerForm.errors?.['mismatch']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">Les mots de passe ne correspondent pas.</small>
            }
          </div>

          </fieldset>

          <button
            type="submit"
            [disabled]="registerForm.invalid || loading()"
            class="mt-4 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading() ? 'Inscription...' : "S'inscrire" }}
          </button>

          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-border"></div></div>
            <div class="relative flex justify-center text-xs"><span class="bg-surface px-2 text-text-muted">ou continuer avec</span></div>
          </div>

          <div class="flex flex-col gap-2">
            <a href="/api/auth/oauth/google"
               class="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-canvas px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </a>
          </div>

          <p class="mt-4 text-center text-sm text-text-muted">
            Déjà un compte ?
            <a routerLink="/auth/login" class="font-medium text-ib-blue hover:underline">Se connecter</a>
          </p>
        </form>
      }

      @if (step() === 'verify') {
        <div class="flex flex-col gap-4">
          <div class="rounded-lg bg-ib-blue/5 border border-ib-blue/20 p-4 text-center">
            <p class="text-sm text-text-primary">
              Un code de vérification a été envoyé à
            </p>
            <p class="mt-1 font-semibold text-text-primary">{{ pendingEmail() }}</p>
          </div>

          <form (submit)="$event.preventDefault(); submitVerify()" class="flex flex-col gap-4">
            <div>
              <label for="code" class="mb-1.5 block text-sm font-medium text-text-primary text-center">
                Code de vérification
              </label>
              <input
                #codeInput
                id="code"
                type="text"
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                class="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="000000"
                (input)="codeValue.set(codeInput.value)"
              />
            </div>

            <button
              type="submit"
              [disabled]="codeValue().length !== 6 || loading()"
              class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading() ? 'Vérification...' : 'Vérifier' }}
            </button>
          </form>

          <div class="flex items-center justify-between text-sm">
            <button
              type="button"
              (click)="resendCode()"
              [disabled]="resending()"
              class="font-medium text-ib-blue hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ resending() ? 'Envoi...' : 'Renvoyer le code' }}
            </button>
            <button
              type="button"
              (click)="backToRegister()"
              class="text-text-muted hover:text-text-primary transition-colors"
            >
              Modifier l'email
            </button>
          </div>
        </div>
      }
    </article>
    </main>
  `,
})
export class Register {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly showPassword = signal(false);
  protected readonly showConfirm = signal(false);
  protected readonly loading = signal(false);
  protected readonly resending = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected readonly step = signal<'register' | 'verify'>('register');
  protected readonly pendingEmail = signal('');
  protected readonly codeValue = signal('');

  constructor() {
    const params = this.route.snapshot.queryParams;
    if (params['verify'] && params['email']) {
      this.pendingEmail.set(params['email']);
      this.step.set('verify');
      this.resendCode();
    }
  }

  protected readonly registerForm = new FormGroup<RegisterFormShape>({
    displayName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12)],
    }),
    confirmPassword: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  }, { validators: [passwordMatchValidator('password', 'confirmPassword')] });

  protected async submitRegister(): Promise<void> {
    if (this.registerForm.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { email, password, displayName } = this.registerForm.getRawValue();
      await this.auth.register(email, password, displayName || undefined);
      this.pendingEmail.set(email);
      this.step.set('verify');
      this.success.set('');
    } catch (err: unknown) {
      this.error.set(this.extractError(err, "Erreur lors de l'inscription."));
    } finally {
      this.loading.set(false);
    }
  }

  protected async submitVerify(): Promise<void> {
    const code = this.codeValue().trim();
    if (code.length !== 6) return;

    this.loading.set(true);
    this.error.set('');

    try {
      await this.auth.verifyCode(this.pendingEmail(), code);
      this.router.navigate(['/budget']);
    } catch (err: unknown) {
      this.error.set(this.extractError(err, 'Code invalide ou expiré.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected async resendCode(): Promise<void> {
    this.resending.set(true);
    this.error.set('');
    this.success.set('');

    try {
      await this.auth.resendCode(this.pendingEmail());
      this.success.set('Un nouveau code a été envoyé.');
    } catch (err: unknown) {
      this.error.set(this.extractError(err, "Erreur lors de l'envoi du code."));
    } finally {
      this.resending.set(false);
    }
  }

  protected backToRegister(): void {
    this.step.set('register');
    this.error.set('');
    this.success.set('');
    this.codeValue.set('');
  }

  private extractError(err: unknown, fallback: string): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const httpErr = err as { error?: { error?: string } };
      return httpErr.error?.error ?? fallback;
    }
    return fallback;
  }
}
