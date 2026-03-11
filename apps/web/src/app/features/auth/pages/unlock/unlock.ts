import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthStore } from '../../domain/auth.store';
import { Icon } from '@shared/components/icon/icon';

type UnlockFormShape = {
  password: FormControl<string>;
};

@Component({
  selector: 'app-unlock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, Icon],
  host: { class: 'flex min-h-screen items-center justify-center bg-canvas p-4' },
  template: `
    <article class="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-lg">
      <header class="mb-6 text-center">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-ib-amber/10">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
               class="text-ib-amber">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold text-text-primary">Deverrouiller vos donnees</h1>
        <p class="mt-2 text-sm text-text-muted">
          Vos donnees sont chiffrees. Saisissez votre mot de passe pour y acceder.
        </p>
      </header>

      @if (error()) {
        <p role="alert" class="mb-4 rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
      }

      <form [formGroup]="form" (ngSubmit)="unlock()" class="flex flex-col gap-4">
        <div>
          <label for="password" class="mb-1.5 block text-sm font-medium text-text-primary">
            Mot de passe
          </label>
          <div class="relative">
            <input
              [type]="showPassword() ? 'text' : 'password'"
              id="password"
              formControlName="password"
              aria-required="true"
              class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              placeholder="Votre mot de passe"
            />
            <button type="button" (click)="showPassword.set(!showPassword())"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              [attr.aria-label]="showPassword() ? 'Masquer' : 'Afficher'">
              <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" size="18" />
            </button>
          </div>
        </div>

        <button
          type="submit"
          [disabled]="form.invalid || loading()"
          class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ loading() ? 'Deverrouillage...' : 'Deverrouiller' }}
        </button>

        <button
          type="button"
          (click)="logout()"
          class="text-sm text-text-muted hover:text-text-primary transition-colors text-center"
        >
          Se deconnecter
        </button>
      </form>
    </article>
  `,
})
export class Unlock {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup<UnlockFormShape>({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected async unlock(): Promise<void> {
    if (this.form.invalid) return;

    this.loading.set(true);
    this.error.set('');

    try {
      const { password } = this.form.getRawValue();
      await this.auth.unlockWithPassword(password);
      this.router.navigate(['/budget']);
    } catch {
      this.error.set('Mot de passe incorrect ou cle de chiffrement invalide.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
