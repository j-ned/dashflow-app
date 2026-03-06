import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../domain/auth.store';

type LoginFormShape = {
  email: FormControl<string>;
  password: FormControl<string>;
};

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <article class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
      <header class="mb-8 text-center">
        <h1 class="text-2xl font-bold text-text-primary">Dash Money</h1>
        <p class="mt-2 text-sm text-text-muted">Gerez vos finances perso & freelance</p>
      </header>

      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="submitLogin()" class="flex flex-col gap-4">
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
              <small class="error" role="alert">L'email est obligatoire.</small>
            } @else if (form.controls.email.errors?.['email']) {
              <small class="error" role="alert">L'email doit avoir un format valide.</small>
            }
          }
        </div>

        <div>
          <label for="password" class="mb-1.5 block text-sm font-medium text-text-primary">
            Mot de passe <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            type="password"
            id="password"
            formControlName="password"
            aria-required="true"
            class="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            placeholder="••••••••"
          />
          @if (form.controls.password.touched) {
            @if (form.controls.password.errors?.['required']) {
              <small class="error" role="alert">Le mot de passe est obligatoire.</small>
            } @else if (form.controls.password.errors?.['minlength']) {
              <small class="error" role="alert">Le mot de passe doit faire au minimum 6 caracteres.</small>
            }
          }
        </div>

        <button
          type="submit"
          [disabled]="form.invalid || loading()"
          class="mt-4 w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
        >
          @if (loading()) {
            Connexion...
          } @else {
            Se connecter
          }
        </button>
      </form>
    </article>
  `
})
export class Login {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup<LoginFormShape>({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected async submitLogin(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email, password);
      this.router.navigate(['/budget']);
    } catch {
      this.error.set('Email ou mot de passe incorrect.');
    } finally {
      this.loading.set(false);
    }
  }
}
