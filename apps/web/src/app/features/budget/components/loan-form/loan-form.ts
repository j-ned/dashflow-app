import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
import { TranslocoPipe } from '@jsverse/transloco';
import { Loan, LoanDirection } from '../../domain/models/loan.model';
import { Member } from '../../domain/models/member.model';

type LoanFormModel = {
  memberId: string;
  person: string;
  amount: number;
  description: string;
  date: string;
  dueDate: string;
  dueDay: number | null;
};

const EMPTY_MODEL: LoanFormModel = {
  memberId: '',
  person: '',
  amount: 0,
  description: '',
  date: '',
  dueDate: '',
  dueDay: null,
};

@Component({
  selector: 'app-loan-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)">
      <fieldset class="space-y-3">
        <legend class="sr-only">
          {{
            initial()
              ? ('budget.loan.form.editLegend' | transloco)
              : direction() === 'lent'
                ? ('budget.loan.form.createLegendLent' | transloco)
                : ('budget.loan.form.createLegendBorrowed' | transloco)
          }}
        </legend>

        <div>
          <label for="loan-member" class="form-label">{{
            'budget.loan.form.member' | transloco
          }}</label>
          <select id="loan-member" [formField]="loanForm.memberId" class="form-select">
            <option value="">{{ 'budget.loan.form.memberGlobal' | transloco }}</option>
            @for (m of members(); track m.id) {
              <option [value]="m.id">{{ m.firstName }} {{ m.lastName }}</option>
            }
          </select>
        </div>

        <div>
          <label for="loan-person" class="form-label">
            {{ 'budget.loan.form.person' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="loan-person"
            type="text"
            [formField]="loanForm.person"
            aria-required="true"
            class="form-input"
          />
          @if (loanForm.person().touched() && loanForm.person().invalid()) {
            @for (err of loanForm.person().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="loan-amount" class="form-label">
            {{ 'budget.loan.form.amount' | transloco }}
            <span aria-hidden="true" class="text-ib-red">*</span>
          </label>
          <input
            id="loan-amount"
            type="number"
            [formField]="loanForm.amount"
            step="0.01"
            aria-required="true"
            class="form-input mono"
          />
          @if (loanForm.amount().touched() && loanForm.amount().invalid()) {
            @for (err of loanForm.amount().errors(); track err.message) {
              <small class="error" role="alert">{{ err.message | transloco }}</small>
            }
          }
        </div>

        <div>
          <label for="loan-description" class="form-label">{{
            'budget.loan.form.description' | transloco
          }}</label>
          <input
            id="loan-description"
            type="text"
            [formField]="loanForm.description"
            class="form-input"
          />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label for="loan-date" class="form-label">
              {{ 'budget.loan.form.date' | transloco }}
              <span aria-hidden="true" class="text-ib-red">*</span>
            </label>
            <input
              id="loan-date"
              type="date"
              [formField]="loanForm.date"
              aria-required="true"
              class="form-input"
            />
            @if (loanForm.date().touched() && loanForm.date().invalid()) {
              @for (err of loanForm.date().errors(); track err.message) {
                <small class="error" role="alert">{{ err.message | transloco }}</small>
              }
            }
          </div>
          <div>
            <label for="loan-due-date" class="form-label">{{
              'budget.loan.form.dueDate' | transloco
            }}</label>
            <input id="loan-due-date" type="date" [formField]="loanForm.dueDate" class="form-input" />
          </div>
          <div>
            <label for="loan-due-day" class="form-label">{{
              'budget.loan.form.depositDay' | transloco
            }}</label>
            <input
              id="loan-due-day"
              type="number"
              [formField]="loanForm.dueDay"
              [placeholder]="'budget.loan.form.depositDayPlaceholder' | transloco"
              class="form-input mono"
            />
            <p class="text-xs mt-1 text-text-muted">
              {{ 'budget.loan.form.depositDayHint' | transloco }}
            </p>
          </div>
        </div>
      </fieldset>

      <footer class="form-footer">
        <button type="button" class="btn-cancel" (click)="cancelled.emit()">
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="submit"
          [disabled]="loanForm().invalid()"
          class="btn-submit"
          [style.background-color]="
            direction() === 'lent' ? 'var(--color-ib-blue)' : 'var(--color-ib-orange)'
          "
        >
          {{
            initial()
              ? ('budget.loan.form.submitEdit' | transloco)
              : direction() === 'lent'
                ? ('budget.loan.form.submitLent' | transloco)
                : ('budget.loan.form.submitBorrowed' | transloco)
          }}
        </button>
      </footer>
    </form>
  `,
})
export class LoanForm {
  readonly direction = input.required<LoanDirection>();
  readonly initial = input<Loan | null>(null);
  readonly members = input<Member[]>([]);
  readonly submitted = output<Omit<Loan, 'id'>>();
  readonly cancelled = output<void>();

  // État dérivé modifiable : se réinitialise quand `initial` change, éditable par le form.
  protected readonly model = linkedSignal<LoanFormModel>(() => {
    const data = this.initial();
    return data
      ? {
          memberId: data.memberId ?? '',
          person: data.person,
          amount: data.amount,
          description: data.description,
          date: data.date,
          dueDate: data.dueDate ?? '',
          dueDay: data.dueDay,
        }
      : { ...EMPTY_MODEL, date: new Date().toISOString().slice(0, 10) };
  });

  protected readonly loanForm = form(this.model, (path) => {
    required(path.person, { message: 'budget.errors.personRequired' });
    required(path.amount, { message: 'budget.errors.amountRequired' });
    min(path.amount, 0.01, { message: 'budget.errors.amountMin' });
    required(path.date, { message: 'budget.errors.dateRequired' });
  });

  protected async submitForm(event: Event): Promise<void> {
    event.preventDefault();
    await submit(this.loanForm, async () => {
      const v = this.model();
      const init = this.initial();
      this.submitted.emit({
        memberId: v.memberId || null,
        person: v.person,
        direction: this.direction(),
        amount: v.amount,
        remaining: init ? init.remaining : v.amount,
        description: v.description,
        date: v.date,
        dueDate: v.dueDate || null,
        dueDay: v.dueDay ?? null,
      });
      return [];
    });
  }
}
