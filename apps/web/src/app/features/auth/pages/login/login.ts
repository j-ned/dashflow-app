import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../domain/auth.store';
import { Icon } from '@shared/components/icon/icon';

type LoginFormShape = {
  email: FormControl<string>;
  password: FormControl<string>;
};

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Icon],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <article class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
      <header class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-text-primary">DashFlow</h1>
        <p class="mt-2 text-sm text-text-muted">Votre tableau de bord personnel</p>
      </header>

      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
      }

      @if (step() === 'credentials') {
        <form [formGroup]="form" (ngSubmit)="submitLogin()" class="flex flex-col gap-4">
          <fieldset class="flex flex-col gap-4">
          <legend class="sr-only">Identifiants de connexion</legend>
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
            @if (form.controls.email.touched) {
              @if (form.controls.email.errors?.['required']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">L'email est obligatoire.</small>
              } @else if (form.controls.email.errors?.['email']) {
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
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showPassword() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (form.controls.password.touched) {
              @if (form.controls.password.errors?.['required']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">Le mot de passe est obligatoire.</small>
              } @else if (form.controls.password.errors?.['minlength']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">Le mot de passe doit faire au minimum 12 caractères.</small>
              }
            }
          </div>

          </fieldset>

          <button
            type="submit"
            [disabled]="form.invalid || loading()"
            class="mt-4 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading() ? 'Connexion...' : 'Se connecter' }}
          </button>

          <p class="mt-2 text-center">
            <a routerLink="/auth/forgot-password" class="text-sm text-text-muted hover:text-ib-blue transition-colors">Mot de passe oublié ?</a>
          </p>

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
            Pas encore de compte ?
            <a routerLink="/auth/register" class="font-medium text-ib-blue hover:underline">S'inscrire</a>
          </p>
        </form>
      }

      @if (step() === 'totp') {
        <div class="flex flex-col gap-4">
          <div class="rounded-lg bg-ib-blue/5 border border-ib-blue/20 p-4 text-center">
            <p class="text-sm text-text-primary">
              Entrez le code de votre application d'authentification
            </p>
          </div>

          <form (submit)="$event.preventDefault(); submitTotp()" class="flex flex-col gap-4">
            <div>
              <label for="totp" class="mb-1.5 block text-sm font-medium text-text-primary text-center">
                Code 2FA
              </label>
              <input
                #totpInput
                id="totp"
                type="text"
                inputmode="numeric"
                pattern="[0-9]{6}"
                maxlength="6"
                autocomplete="one-time-code"
                class="w-full rounded-lg border border-border bg-canvas px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="000000"
                (input)="totpValue.set(totpInput.value)"
              />
            </div>

            <button
              type="submit"
              [disabled]="totpValue().length !== 6 || loading()"
              class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ loading() ? 'Vérification...' : 'Vérifier' }}
            </button>
          </form>

          <button
            type="button"
            (click)="backToCredentials()"
            class="text-sm text-text-muted hover:text-text-primary transition-colors text-center"
          >
            Retour
          </button>
        </div>
      }
    </article>
  `
})
export class Login {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly step = signal<'credentials' | 'totp'>('credentials');
  protected readonly totpValue = signal('');

  constructor() {
    this.handleOAuthCallback();
  }

  private async handleOAuthCallback(): Promise<void> {
    const params = this.route.snapshot.queryParams;

    if (params['error']) {
      const messages: Record<string, string> = {
        oauth_failed: 'Erreur lors de la connexion OAuth.',
        oauth_expired: 'La session OAuth a expiré, réessayez.',
        oauth_no_email: 'Aucun courriel récupéré du fournisseur.',
      };
      this.error.set(messages[params['error']] ?? 'Erreur de connexion.');
      return;
    }

    if (params['token']) {
      this.loading.set(true);
      try {
        await this.auth.loginWithToken(params['token']);
        this.redirectAfterLogin();
      } catch {
        this.error.set('Erreur lors de la connexion.');
      } finally {
        this.loading.set(false);
      }
    }
  }

  protected readonly form = new FormGroup<LoginFormShape>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12)],
    }),
  });

  protected async submitLogin(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      this.redirectAfterLogin();
    } catch (err: unknown) {
      if (this.getErrorCode(err) === 'EMAIL_NOT_VERIFIED') {
        const { email } = this.form.getRawValue();
        this.router.navigate(['/auth/register'], { queryParams: { email, verify: true } });
        return;
      }
      if (this.getErrorCode(err) === 'TOTP_REQUIRED') {
        this.step.set('totp');
        this.error.set('');
      } else {
        this.error.set('Email ou mot de passe incorrect.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async submitTotp(): Promise<void> {
    const code = this.totpValue().trim();
    if (code.length !== 6) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password, code);
      this.redirectAfterLogin();
    } catch {
      this.error.set('Code 2FA invalide.');
    } finally {
      this.loading.set(false);
    }
  }

  protected backToCredentials(): void {
    this.step.set('credentials');
    this.totpValue.set('');
    this.error.set('');
  }

  private redirectAfterLogin(): void {
    const user = this.auth.user();
    if (user && user.encryptionVersion === 0) {
      this.router.navigate(['/auth/encryption-setup'], { replaceUrl: true });
    } else if (this.auth.needsUnlock()) {
      this.router.navigate(['/auth/unlock'], { replaceUrl: true });
    } else {
      this.router.navigate(['/budget'], { replaceUrl: true });
    }
  }

  private getErrorCode(err: unknown): string | undefined {
    if (err && typeof err === 'object' && 'code' in err) {
      return (err as { code?: string }).code;
    }
    return undefined;
  }
}
