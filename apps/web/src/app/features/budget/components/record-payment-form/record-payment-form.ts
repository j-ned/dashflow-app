import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { BankAccount } from '../../domain/models/bank-account.model';

type PaymentFormShape = {
  amount: FormControl<number>;
  date: FormControl<string>;
  accountId: FormControl<string>;
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

        <div>
          <label for="payment-date" class="form-label">Date</label>
          <input id="payment-date" type="date" formControlName="date" class="form-input" />
        </div>

        @if (accounts().length > 0) {
          <div>
            <label for="payment-account" class="form-label">Décompter du compte</label>
            <select id="payment-account" formControlName="accountId" class="form-input">
              <option value="">Ne pas décompter</option>
              @for (acc of accounts(); track acc.id) {
                <option [value]="acc.id">{{ acc.name }}</option>
              }
            </select>
            <p class="text-xs mt-1 text-text-muted">Créera une dépense sur le compte sélectionné</p>
          </div>
        }
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">Annuler</button>
        <button type="submit" [disabled]="isInvalid()"
                class="btn-submit bg-ib-blue">
          Valider
        </button>
      </footer>
    </form>
  `,
})
export class RecordPaymentForm {
  readonly accounts = input<BankAccount[]>([]);
  readonly submitted = output<{ amount: number; date: string; accountId: string | null }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<PaymentFormShape>({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true }),
    accountId: new FormControl('', { nonNullable: true }),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      amount: v.amount,
      date: v.date,
      accountId: v.accountId || null,
    });
    this.form.reset({ amount: 0, date: new Date().toISOString().slice(0, 10), accountId: '' });
  }
}
