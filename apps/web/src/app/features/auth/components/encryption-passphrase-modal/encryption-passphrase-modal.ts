import { Component, ChangeDetectionStrategy, output, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
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
  imports: [ModalDialog, ReactiveFormsModule, Icon],
  host: { class: 'contents' },
  template: `
    <app-modal-dialog #modal title="Passphrase de chiffrement" size="md" (closed)="closed.emit()">
      <div class="flex flex-col gap-4">
        <div class="rounded-lg bg-ib-blue/10 border border-ib-blue/20 p-4">
          <p class="text-sm text-text-primary">
            Votre compte utilise la connexion Google. Definissez une passphrase
            pour proteger vos donnees chiffrees. Elle sera demandee a chaque connexion.
          </p>
        </div>

        @if (error()) {
          <p role="alert" class="rounded-md bg-ib-red/10 p-3 text-sm text-ib-red">{{ error() }}</p>
        }

        <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
          <fieldset class="flex flex-col gap-4">
          <legend class="sr-only">Passphrase de chiffrement</legend>
          <div>
            <label for="passphrase" class="mb-1.5 block text-sm font-medium text-text-primary">
              Passphrase <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showPassphrase() ? 'text' : 'password'"
                id="passphrase"
                formControlName="passphrase"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="Votre passphrase de chiffrement"
              />
              <button type="button" (click)="showPassphrase.set(!showPassphrase())"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showPassphrase() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showPassphrase() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (form.controls.passphrase.touched) {
              @if (form.controls.passphrase.errors?.['required']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">La passphrase est obligatoire.</small>
              } @else if (form.controls.passphrase.errors?.['minlength']) {
                <small class="mt-1 block text-xs text-ib-red" role="alert">Minimum 8 caracteres.</small>
              }
            }
          </div>

          <div>
            <label for="confirm" class="mb-1.5 block text-sm font-medium text-text-primary">
              Confirmer <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <div class="relative">
              <input
                [type]="showConfirm() ? 'text' : 'password'"
                id="confirm"
                formControlName="confirm"
                aria-required="true"
                class="w-full rounded-lg border border-border bg-canvas px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                placeholder="Confirmer la passphrase"
              />
              <button type="button" (click)="showConfirm.set(!showConfirm())"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                [attr.aria-label]="showConfirm() ? 'Masquer' : 'Afficher'">
                <app-icon [name]="showConfirm() ? 'eye-off' : 'eye'" size="18" />
              </button>
            </div>
            @if (
              (form.controls.passphrase.touched || form.controls.confirm.touched) &&
              form.errors?.['mismatch']
            ) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">Les passphrases ne correspondent pas.</small>
            }
          </div>
          </fieldset>

          <button
            type="submit"
            [disabled]="form.invalid || loading()"
            class="w-full rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ib-blue/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading() ? 'Configuration...' : 'Definir la passphrase' }}
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
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly form = new FormGroup<PassphraseFormShape>({
    passphrase: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    confirm: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  }, { validators: [passwordMatchValidator('passphrase', 'confirm')] });

  protected submit(): void {
    if (this.form.invalid) return;

    const { passphrase } = this.form.getRawValue();
    this.passphraseSet.emit(passphrase);
    this.modal().close();
  }

  open(): void {
    this.form.reset();
    this.error.set('');
    this.modal().open();
  }
}
