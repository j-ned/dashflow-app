import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

type PaymentFormShape = {
  amount: FormControl<number>;
};

@Component({
  selector: 'app-record-payment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Remboursement</legend>

        <div>
          <label for="payment-amount" class="form-label">
            Montant du remboursement <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input id="payment-amount" type="number" formControlName="amount" step="0.01" min="0.01" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.amount.touched) {
            @if (form.controls.amount.errors?.['required']) {
              <small class="error" role="alert">Le montant est obligatoire.</small>
            } @else if (form.controls.amount.errors?.['min']) {
              <small class="error" role="alert">Le montant doit être supérieur à 0.</small>
            }
          }
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="form.invalid"
                class="btn-submit" style="background-color: var(--color-ib-blue)">
          Valider
        </button>
      </footer>
    </form>
  `,
})
export class RecordPaymentForm {
  readonly submitted = output<{ amount: number }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<PaymentFormShape>({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
  });

  protected submitForm() {
    if (this.form.invalid) return;
    this.submitted.emit({ amount: this.form.getRawValue().amount });
    this.form.reset();
  }
}
