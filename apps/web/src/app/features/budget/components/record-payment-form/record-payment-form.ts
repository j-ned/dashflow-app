import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { form, FormField, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { BankAccount } from '../../domain/models/bank-account.model';
import { todayIso } from '@shared/utils/local-date';

type RecordPaymentModel = {
  amount: number;
  date: string;
  accountId: string;
  note: string;
};

function emptyModel(): RecordPaymentModel {
  return { amount: 0, date: todayIso(), accountId: '', note: '' };
}

@Component({
  selector: 'app-record-payment-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe, DecimalPipe],
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
          @if (remaining(); as due) {
            <p class="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-text-muted">
              <span data-testid="payment-remaining">{{
                'budget.loan.paymentForm.remainingHint'
                  | transloco: { amount: (due | number: '1.2-2') }
              }}</span>
              <button
                type="button"
                class="font-medium text-ib-blue hover:underline"
                data-testid="payment-pay-all"
                (click)="payAll(due)"
              >
                {{ 'budget.loan.paymentForm.payAll' | transloco }}
              </button>
            </p>
          }
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
  /** Restant dû du prêt : un remboursement supérieur est refusé par l'API, autant le dire avant. */
  readonly remaining = input<number | null>(null);
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
    max(path.amount, () => this.remaining() ?? undefined, {
      message: 'budget.errors.amountAboveRemaining',
    });
    maxLength(path.note, 255);
  });

  protected payAll(due: number): void {
    this.model.update((m) => ({ ...m, amount: due }));
  }

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
