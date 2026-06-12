import { Component, ChangeDetectionStrategy, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import { passwordMatchValidator } from '@shared/validators/form-validators';

type PassphraseFormShape = {
  passphrase: FormControl<string>;
  confirm: FormControl<string>;
};

@Component({
  selector: 'app-encryption-passphrase-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalDialog, ReactiveFormsModule, Icon, TranslocoPipe],
  host: { class: 'contents' },
  template: `
    <app-modal-dialog
      #modal
      [title]="'auth.passphraseModal.title' | transloco"
      size="md"
      (closed)="closed.emit()"
    >
      <div class="flex flex-col gap-4">
        <div class="rounded-lg bg-ib-blue/10 border border-ib-blue/20 p-4">
          <p class="text-sm text-text-primary">
            {{ 'auth.passphraseModal.intro' | transloco }}
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <fieldset class="flex flex-col gap-4">
            <legend class="sr-only">{{ 'auth.passphraseModal.legend' | transloco }}</legend>
            <div>
              <label for="passphrase" class="mb-1.5 block text-sm font-medium text-text-primary">
                {{ 'auth.passphraseModal.passphrase' | transloco }}
                <span aria-hidden="true" class="text-ib-red">*</span>
              </label>
              <div class="relative">
                <input
                  [type]="showPassphrase() ? 'text' : 'password'"
                  id="passphrase"
                  formControlName="passphrase"
                  aria-required="true"
                  class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-12 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                  [placeholder]="'auth.passphraseModal.passphrasePlaceholder' | transloco"
                />
                <button
                  type="button"
                  (click)="showPassphrase.set(!showPassphrase())"
                  class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                  [attr.aria-label]="(showPassphrase() ? 'auth.hide' : 'auth.show') | transloco"
                >
                  <app-icon [name]="showPassphrase() ? 'eye-off' : 'eye'" size="18" />
                </button>
              </div>
              @if (form.controls.passphrase.touched) {
                @if (form.controls.passphrase.errors?.['required']) {
                  <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                    'auth.passphraseModal.passphraseRequired' | transloco
                  }}</small>
                } @else if (form.controls.passphrase.errors?.['minlength']) {
                  <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                    'auth.passphraseModal.passphraseMin' | transloco
                  }}</small>
                }
              }
            </div>

            <div>
              <label for="confirm" class="mb-1.5 block text-sm font-medium text-text-primary">
                {{ 'auth.passphraseModal.confirm' | transloco }}
                <span aria-hidden="true" class="text-ib-red">*</span>
              </label>
              <div class="relative">
                <input
                  [type]="showConfirm() ? 'text' : 'password'"
                  id="confirm"
                  formControlName="confirm"
                  aria-required="true"
                  class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-12 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                  [placeholder]="'auth.passphraseModal.confirmPlaceholder' | transloco"
                />
                <button
                  type="button"
                  (click)="showConfirm.set(!showConfirm())"
                  class="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-11 h-11 text-text-muted hover:text-text-primary transition-colors"
                  [attr.aria-label]="(showConfirm() ? 'auth.hide' : 'auth.show') | transloco"
                >
                  <app-icon [name]="showConfirm() ? 'eye-off' : 'eye'" size="18" />
                </button>
              </div>
              @if (
                (form.controls.passphrase.touched || form.controls.confirm.touched) &&
                form.errors?.['mismatch']
              ) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                  'auth.passphraseModal.mismatch' | transloco
                }}</small>
              }
            </div>
          </fieldset>

          <button
            type="submit"
            [disabled]="form.invalid"
            class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ 'auth.passphraseModal.submit' | transloco }}
          </button>
        </form>
      </div>
    </app-modal-dialog>
  `,
})
export class EncryptionPassphraseModal {
  readonly closed = output<void>();
  readonly passphraseSet = output<string>();

  private readonly modal = viewChild.required(ModalDialog);

  protected readonly showPassphrase = signal(false);
  protected readonly showConfirm = signal(false);

  protected readonly form = new FormGroup<PassphraseFormShape>(
    {
      passphrase: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8)],
      }),
      confirm: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: [passwordMatchValidator('passphrase', 'confirm')] },
  );

  protected submit(): void {
    if (this.form.invalid) return;

    const { passphrase } = this.form.getRawValue();
    this.passphraseSet.emit(passphrase);
    this.modal().close();
  }

  open(): void {
    this.form.reset();
    this.modal().open();
  }
}
