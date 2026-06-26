import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { form, FormField, maxLength, min, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { BankAccount } from '../../domain/models/bank-account.model';

type RecordPaymentModel = {
  amount: number;
  date: string;
  accountId: string;
  note: string;
};

function emptyModel(): RecordPaymentModel {
  return { amount: 0, date: new Date().toISOString().slice(0, 10), accountId: '', note: '' };
}

@Component({
  selector: 'app-record-payment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
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
            [formField]="recordPaymentForm.amount"
            step="0.01"
            aria-required="true"
            class="form-input mono"
          />
          @if (recordPaymentForm.amount().touched() && recordPaymentForm.amount().invalid()) {
            @for (err of recordPaymentForm.amount().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="payment-date" class="form-label">{{
            'budget.loan.paymentForm.date' | transloco
          }}</label>
          <input
            id="payment-date"
            type="date"
            [formField]="recordPaymentForm.date"
            class="form-input"
          />
        </div>

        <div>
          <label for="payment-note" class="form-label">{{
            'budget.loan.paymentForm.note' | transloco
          }}</label>
          <input
            id="payment-note"
            type="text"
            [formField]="recordPaymentForm.note"
            [placeholder]="'budget.loan.paymentForm.notePlaceholder' | transloco"
            class="form-input"
          />
        </div>

        @if (accounts().length > 0) {
          <div>
            <label for="payment-account" class="form-label">{{
              'budget.loan.paymentForm.deductFromAccount' | transloco
            }}</label>
            <select
              id="payment-account"
              [formField]="recordPaymentForm.accountId"
              class="form-input"
            >
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
        <button
          type="submit"
          [disabled]="recordPaymentForm().invalid()"
          class="btn-submit bg-ib-blue"
        >
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

  protected readonly model = signal<RecordPaymentModel>(emptyModel());

  protected readonly recordPaymentForm = form(this.model, (path) => {
    required(path.amount, { message: 'budget.errors.amountRequired' });
    min(path.amount, 0.01, { message: 'budget.errors.amountMin' });
    maxLength(path.note, 255);
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.recordPaymentForm, async () => {
      const v = this.model();
      this.submitted.emit({
        amount: v.amount,
        date: v.date,
        accountId: v.accountId || null,
        note: v.note.trim() || null,
      });
      this.model.set(emptyModel());
      return [];
    });
  }
}
