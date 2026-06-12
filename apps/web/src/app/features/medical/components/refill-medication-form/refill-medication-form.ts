import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { formInvalid } from '@shared/forms/form-invalid';

type RefillFormShape = {
  quantity: FormControl<number>;
};

@Component({
  selector: 'app-refill-medication-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ 'medical.medication.refill.legend' | transloco }}</legend>

        <div>
          <label for="refill-quantity" class="form-label">
            {{ 'medical.medication.refill.quantity' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="refill-quantity"
            type="number"
            formControlName="quantity"
            min="1"
            aria-required="true"
            class="form-input mono"
          />
          @if (form.controls.quantity.touched) {
            @if (form.controls.quantity.errors?.['required']) {
              <small class="error" role="alert">{{
                'medical.medication.refill.quantityRequired' | transloco
              }}</small>
            } @else if (form.controls.quantity.errors?.['min']) {
              <small class="error" role="alert">{{
                'medical.medication.refill.quantityMin' | transloco
              }}</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="isInvalid()" class="btn-submit bg-ib-purple">
          {{ 'medical.medication.refill.submit' | transloco }}
        </button>
      </footer>
    </form>
  `,
})
export class RefillMedicationForm {
  readonly submitted = output<{ quantity: number }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<RefillFormShape>({
    quantity: new FormControl(1, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  protected readonly isInvalid = formInvalid(this.form);

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({ quantity: v.quantity });
    this.form.reset();
  }
}
