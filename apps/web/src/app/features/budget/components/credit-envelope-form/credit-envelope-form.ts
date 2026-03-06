import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

type CreditFormShape = {
  amount: FormControl<number>;
};

@Component({
  selector: 'app-credit-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">Créditer / Débiter</legend>

        <div>
          <label for="credit-amount" class="form-label">
            Montant <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <p class="text-xs mb-2" style="color: var(--color-text-muted)">Positif pour créditer, négatif pour débiter</p>
          <input id="credit-amount" type="number" formControlName="amount" step="0.01" aria-required="true"
                 class="form-input mono" />
          @if (form.controls.amount.touched && form.controls.amount.errors?.['required']) {
            <small class="error" role="alert">Le montant est obligatoire.</small>
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
export class CreditEnvelopeForm {
  readonly submitted = output<{ amount: number }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<CreditFormShape>({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
  });

  protected submitForm() {
    if (this.form.invalid) return;
    this.submitted.emit({ amount: this.form.getRawValue().amount });
    this.form.reset();
  }
}
