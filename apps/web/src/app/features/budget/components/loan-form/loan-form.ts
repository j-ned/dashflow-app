import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TranslocoPipe } from '@jsverse/transloco';
import { Loan, LoanDirection } from '../../domain/models/loan.model';
import { Member } from '../../domain/models/member.model';

type LoanFormShape = {
  memberId: FormControl<string>;
  person: FormControl<string>;
  amount: FormControl<number>;
  description: FormControl<string>;
  date: FormControl<string>;
  dueDate: FormControl<string>;
  dueDay: FormControl<number | null>;
};

@Component({
  selector: 'app-loan-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submitForm()">
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
          <select id="loan-member" formControlName="memberId" class="form-select">
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
            formControlName="person"
            aria-required="true"
            class="form-input"
          />
          @if (form.controls.person.touched && form.controls.person.errors?.['required']) {
            <small class="error" role="alert">{{
              'budget.errors.personRequired' | transloco
            }}</small>
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
          <label for="loan-description" class="form-label">{{
            'budget.loan.form.description' | transloco
          }}</label>
          <input
            id="loan-description"
            type="text"
            formControlName="description"
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
              formControlName="date"
              aria-required="true"
              class="form-input"
            />
            @if (form.controls.date.touched && form.controls.date.errors?.['required']) {
              <small class="error" role="alert">{{
                'budget.errors.dateRequired' | transloco
              }}</small>
            }
          </div>
          <div>
            <label for="loan-due-date" class="form-label">{{
              'budget.loan.form.dueDate' | transloco
            }}</label>
            <input id="loan-due-date" type="date" formControlName="dueDate" class="form-input" />
          </div>
          <div>
            <label for="loan-due-day" class="form-label">{{
              'budget.loan.form.depositDay' | transloco
            }}</label>
            <input
              id="loan-due-day"
              type="number"
              formControlName="dueDay"
              min="1"
              max="31"
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
          [disabled]="isInvalid()"
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

  protected readonly form = new FormGroup<LoanFormShape>({
    memberId: new FormControl('', { nonNullable: true }),
    person: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    description: new FormControl('', { nonNullable: true }),
    date: new FormControl(new Date().toISOString().slice(0, 10), {
      nonNullable: true,
      validators: [Validators.required],
    }),
    dueDate: new FormControl('', { nonNullable: true }),
    dueDay: new FormControl<number | null>(null),
  });

  protected readonly isInvalid = toSignal(
    this.form.statusChanges.pipe(map(() => this.form.invalid)),
    { initialValue: this.form.invalid },
  );

  constructor() {
    effect(() => {
      const data = this.initial();
      if (data) {
        this.form.patchValue({
          memberId: data.memberId ?? '',
          person: data.person,
          amount: data.amount,
          description: data.description,
          date: data.date,
          dueDate: data.dueDate ?? '',
          dueDay: data.dueDay,
        });
      } else {
        this.form.reset();
      }
    });
  }

  protected submitForm() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
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
  }
}
