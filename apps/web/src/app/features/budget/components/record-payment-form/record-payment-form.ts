import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { BankAccount } from '../../domain/models/bank-account.model';
import { formInvalid } from '@shared/forms/form-invalid';

type PaymentFormShape = {
  amount: FormControl<number>;
  date: FormControl<string>;
  accountId: FormControl<string>;
  note: FormControl<string>;
};

@Component({
  selector: 'app-record-payment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ 'budget.loan.paymentForm.legend' | transloco }}</legend>

        <div>
          <label for="payment-amount" class="form-label">
            {{ 'budget.loan.paymentForm.amount' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="payment-amount"
            type="number"
            formControlName="amount"
            step="0.01"
            min="0.01"
            aria-required="true"
            class="form-input mono"
          />
          @if (form.controls.amount.touched) {
            @if (form.controls.amount.errors?.['required']) {
              <small class="error" role="alert">{{
                'budget.errors.amountRequired' | transloco
              }}</small>
            } @else if (form.controls.amount.errors?.['min']) {
              <small class="error" role="alert">{{ 'budget.errors.amountMin' | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="payment-date" class="form-label">{{
            'budget.loan.paymentForm.date' | transloco
          }}</label>
          <input id="payment-date" type="date" formControlName="date" class="form-input" />
        </div>

        <div>
          <label for="payment-note" class="form-label">{{
            'budget.loan.paymentForm.note' | transloco
          }}</label>
          <input
            id="payment-note"
            type="text"
            formControlName="note"
            maxlength="255"
            [placeholder]="'budget.loan.paymentForm.notePlaceholder' | transloco"
            class="form-input"
          />
        </div>

        @if (accounts().length > 0) {
          <div>
            <label for="payment-account" class="form-label">{{
              'budget.loan.paymentForm.deductFromAccount' | transloco
            }}</label>
            <select id="payment-account" formControlName="accountId" class="form-input">
              <option value="">{{ 'budget.loan.paymentForm.noDeduction' | transloco }}</option>
              @for (acc of accounts(); track acc.id) {
                <option [value]="acc.id">{{ acc.name }}</option>
              }
            </select>
            <p class="text-xs mt-1 text-text-muted">
              {{ 'budget.loan.paymentForm.deductionHint' | transloco }}
            </p>
          </div>
        }
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="submit" [disabled]="isInvalid()" class="btn-submit bg-ib-blue">
          {{ 'budget.actions.validate' | transloco }}
        </button>
      </footer>
    </form>
  `,
})
export class RecordPaymentForm {
  readonly accounts = input<BankAccount[]>([]);
  readonly submitted = output<{
    amount: number;
    date: string;
    accountId: string | null;
    note: string | null;
  }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<PaymentFormShape>({
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true }),
    accountId: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
  });

  protected readonly isInvalid = formInvalid(this.form);

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      amount: v.amount,
      date: v.date,
      accountId: v.accountId || null,
      note: v.note.trim() || null,
    });
    this.form.reset({
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      accountId: '',
      note: '',
    });
  }
}
