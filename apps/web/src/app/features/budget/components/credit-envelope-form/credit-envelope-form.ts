import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { BankAccount } from '../../domain/models/bank-account.model';
import { formInvalid } from '@shared/forms/form-invalid';

type CreditFormShape = {
  amount: FormControl<number>;
  date: FormControl<string>;
  note: FormControl<string>;
  accountId: FormControl<string>;
};

@Component({
  selector: 'app-credit-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
      <fieldset class="space-y-3">
        <legend class="sr-only">{{ 'budget.envelope.creditForm.legend' | transloco }}</legend>

        <div>
          <label for="credit-amount" class="form-label">
            {{ 'budget.envelope.creditForm.amount' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <p class="text-xs mb-2 text-text-muted">
            {{ 'budget.envelope.creditForm.amountHint' | transloco }}
          </p>
          <input
            id="credit-amount"
            type="number"
            formControlName="amount"
            step="0.01"
            aria-required="true"
            class="form-input mono"
          />
          @if (form.controls.amount.touched && form.controls.amount.errors?.['required']) {
            <small class="error" role="alert">{{
              'budget.errors.amountRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="credit-date" class="form-label">{{
            'budget.envelope.creditForm.date' | transloco
          }}</label>
          <input id="credit-date" type="date" formControlName="date" class="form-input" />
        </div>

        <div>
          <label for="credit-note" class="form-label">{{
            'budget.envelope.creditForm.note' | transloco
          }}</label>
          <input
            id="credit-note"
            type="text"
            formControlName="note"
            maxlength="255"
            [placeholder]="'budget.envelope.creditForm.notePlaceholder' | transloco"
            class="form-input"
          />
        </div>

        @if (accounts().length > 0) {
          <div>
            <label for="credit-account" class="form-label">{{
              'budget.envelope.creditForm.deductFromAccount' | transloco
            }}</label>
            <select id="credit-account" formControlName="accountId" class="form-select">
              <option value="">{{ 'budget.envelope.creditForm.noDeduction' | transloco }}</option>
              @for (acc of accounts(); track acc.id) {
                <option [value]="acc.id">{{ acc.name }}</option>
              }
            </select>
            <p class="text-xs mt-1 text-text-muted">
              {{ 'budget.envelope.creditForm.deductionHint' | transloco }}
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
export class CreditEnvelopeForm {
  readonly accounts = input<BankAccount[]>([]);
  readonly submitted = output<{
    amount: number;
    date: string;
    note: string | null;
    accountId: string | null;
  }>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup<CreditFormShape>({
    amount: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    date: new FormControl(new Date().toISOString().slice(0, 10), { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
    accountId: new FormControl('', { nonNullable: true }),
  });

  protected readonly isInvalid = formInvalid(this.form);

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.submitted.emit({
      amount: v.amount,
      date: v.date,
      note: v.note.trim() || null,
      accountId: v.accountId || null,
    });
    this.form.reset({
      amount: 0,
      date: new Date().toISOString().slice(0, 10),
      note: '',
      accountId: '',
    });
  }
}
