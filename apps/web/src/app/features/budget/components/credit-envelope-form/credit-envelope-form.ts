import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { form, FormField, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { BankAccount } from '../../domain/models/bank-account.model';

type CreditModel = {
  amount: number;
  date: string;
  note: string;
  accountId: string;
};

function emptyModel(): CreditModel {
  return { amount: 0, date: new Date().toISOString().slice(0, 10), note: '', accountId: '' };
}

@Component({
  selector: 'app-credit-envelope-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
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
            [formField]="creditForm.amount"
            step="0.01"
            aria-required="true"
            class="form-input mono"
          />
          @if (creditForm.amount().touched() && creditForm.amount().invalid()) {
            @for (err of creditForm.amount().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="credit-date" class="form-label">{{
            'budget.envelope.creditForm.date' | transloco
          }}</label>
          <input id="credit-date" type="date" [formField]="creditForm.date" class="form-input" />
        </div>

        <div>
          <label for="credit-note" class="form-label">{{
            'budget.envelope.creditForm.note' | transloco
          }}</label>
          <input
            id="credit-note"
            type="text"
            [formField]="creditForm.note"
            [placeholder]="'budget.envelope.creditForm.notePlaceholder' | transloco"
            class="form-input"
          />
        </div>

        @if (accounts().length > 0) {
          <div>
            <label for="credit-account" class="form-label">{{
              'budget.envelope.creditForm.deductFromAccount' | transloco
            }}</label>
            <select id="credit-account" [formField]="creditForm.accountId" class="form-select">
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
        <button type="submit" [disabled]="creditForm().invalid()" class="btn-submit bg-ib-blue">
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

  protected readonly model = signal<CreditModel>(emptyModel());

  protected readonly creditForm = form(this.model, (path) => {
    required(path.amount, { message: 'budget.errors.amountRequired' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.creditForm, async () => {
      const v = this.model();
      this.submitted.emit({
        amount: v.amount,
        date: v.date,
        note: v.note.trim() || null,
        accountId: v.accountId || null,
      });
      this.model.set(emptyModel());
      return [];
    });
  }
}
