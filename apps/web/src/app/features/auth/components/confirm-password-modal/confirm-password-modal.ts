import { Component, ChangeDetectionStrategy, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';

type ConfirmPasswordFormShape = {
  password: FormControl<string>;
};

@Component({
  selector: 'app-confirm-password-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, ReactiveFormsModule, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <app-modal-dialog
      #modal
      [title]="'auth.confirmPasswordModal.title' | transloco"
      size="sm"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <fieldset class="flex flex-col gap-4">
          <legend class="sr-only">{{ 'auth.confirmPasswordModal.title' | transloco }}</legend>
          <div>
            <label
              for="confirm-password"
              class="mb-1.5 block text-sm font-medium text-text-primary"
            >
              {{ 'auth.confirmPasswordModal.label' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showPassword() ? 'text' : 'password'"
                id="confirm-password"
                formControlName="password"
                aria-required="true"
                autocomplete="current-password"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-12 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                [placeholder]="'auth.confirmPasswordModal.placeholder' | transloco"
              />
              <button
                type="button"
                (click)="showPassword.set(!showPassword())"
                class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="(showPassword() ? 'auth.hide' : 'auth.show') | transloco"
              >
                <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (form.controls.password.touched && form.controls.password.errors?.['required']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                'auth.confirmPasswordModal.required' | transloco
              }}</small>
            }
          </div>
        </fieldset>

        <button
          type="submit"
          [disabled]="form.invalid"
          class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ 'auth.confirmPasswordModal.submit' | transloco }}
        </button>
      </form>
    </app-modal-dialog>
  `,
})
export class ConfirmPasswordModal {
  readonly closed = output<void>();
  readonly confirmed = output<string>();

  private readonly modal = viewChild.required(ModalDialog);

  protected readonly showPassword = signal(false);

  protected readonly form = new FormGroup<ConfirmPasswordFormShape>({
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected submit(): void {
    if (this.form.invalid) return;

    const { password } = this.form.getRawValue();
    // Ne jamais garder le mot de passe en mémoire au-delà de l'émission : le consommateur
    // (EncryptionSetup) le passe immédiatement à unlock() puis le zéroise à son tour.
    this.form.reset();
    this.confirmed.emit(password);
    this.modal().close();
  }

  open(): void {
    this.form.reset();
    this.showPassword.set(false);
    this.modal().open();
  }
}
