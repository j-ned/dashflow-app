import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';

type RefillFormShape = {
  quantity: FormControl<number>;
};

@Component({
  selector: 'app-refill-medication-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Réapprovisionner le médicament</legend>

        <div>
          <label for="refill-quantity" class="form-label">
            Quantité à ajouter <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="refill-quantity" type="number" formControlName="quantity" min="1" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.quantity.touched) {
            @if (form.controls.quantity.errors?.['required']) {
              <small class="error" role="alert">La quantité est obligatoire.</small>
            } @else if (form.controls.quantity.errors?.['min']) {
              <small class="error" role="alert">La quantité doit être d'au minimum 1.</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit" style="background-color: var(--color-ib-purple)">
          Réapprovisionner
        </button>
      </footer>
    </form>
  `,
})
export class RefillMedicationForm {
  readonly submitted = output<{ quantity: number }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<RefillFormShape>({
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(1)] }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({ quantity: v.quantity });
    this.form.reset();
  }
}
