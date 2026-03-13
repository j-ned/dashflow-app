import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

type SharedAccessFormShape = {
  invitedEmail: FormControl<string>;
};

@Component({
  selector: 'app-shared-access-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Partager l'accès calendrier</legend>

        <div>
          <label for="sa-email" class="form-label">
            Email <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="sa-email" type="email" formControlName="invitedEmail" aria-required="true"
                 class="form-input" />
          @if (form.controls.invitedEmail.touched) {
            @if (form.controls.invitedEmail.errors?.['required']) {
              <small class="error" role="alert">L'email est obligatoire.</small>
            } @else if (form.controls.invitedEmail.errors?.['email']) {
              <small class="error" role="alert">Format email invalide.</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          Partager
        </button>
      </footer>
    </form>
  `,
})
export class SharedAccessForm {
  readonly submitted = output<{ invitedEmail: string }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<SharedAccessFormShape>({
    invitedEmail: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({ invitedEmail: v.invitedEmail });
    this.form.reset();
  }
}
