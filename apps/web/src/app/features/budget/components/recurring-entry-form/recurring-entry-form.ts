import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { map } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import { BankAccount } from '../../domain/models/bank-account.model';
import { Member } from '../../domain/models/member.model';
import { BUDGET_CATEGORIES } from '../../domain/categories';
import { buildRecurringEntryPayload } from '../../domain/recurring-entry-payload';
import {
  Destination,
  TransferMode,
  defaultDestination,
  defaultTransferMode,
  deriveActiveType,
  destinationToggleVisible,
  payslipZoneVisible,
  targetAccountsFor,
  transferModeToggleVisible,
} from '../../domain/recurring-entry-type';
import { PayslipDropzone } from '../payslip-dropzone/payslip-dropzone';

type RecurringEntryFormShape = {
  label: FormControl<string>;
  amount: FormControl<number>;
  dayOfMonth: FormControl<number | null>;
  date: FormControl<string>;
  endDate: FormControl<string>;
  toAccountId: FormControl<string>;
  category: FormControl<string>;
  memberId: FormControl<string>;
  autoPost: FormControl<boolean>;
};

@Component({
  selector: 'app-recurring-entry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoPipe, PayslipDropzone],
  host: { class: 'block' },
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
      <fieldset class="space-y-4">
        <legend class="sr-only">{{ 'budget.recurringForm.legend' | transloco }}</legend>

        <div>
          <label for="re-label" class="block text-sm font-medium text-text-muted mb-1"
            >{{ 'budget.recurringForm.label' | transloco }} <span aria-hidden="true">*</span></label
          >
          <input
            id="re-label"
            type="text"
            formControlName="label"
            aria-required="true"
            class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            [placeholder]="labelPlaceholder()"
          />
          @if (form.controls.label.touched && form.controls.label.errors?.['required']) {
            <small class="mt-1 block text-xs text-ib-red" role="alert">{{
              'budget.errors.labelRequired' | transloco
            }}</small>
          }
        </div>

        <div>
          <label for="re-amount" class="block text-sm font-medium text-text-muted mb-1"
            >{{ 'budget.recurringForm.amount' | transloco }}
            <span aria-hidden="true">*</span></label
          >
          <input
            id="re-amount"
            type="number"
            formControlName="amount"
            step="0.01"
            min="0"
            aria-required="true"
            class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            [placeholder]="'budget.recurringForm.amountPlaceholder' | transloco"
          />
          @if (form.controls.amount.touched) {
            @if (form.controls.amount.errors?.['required']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                'budget.errors.amountRequired' | transloco
              }}</small>
            } @else if (form.controls.amount.errors?.['min']) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                'budget.errors.amountMin' | transloco
              }}</small>
            }
          }
        </div>

        @if (showDestinationToggle()) {
          <div>
            <p id="re-destination-label" class="text-xs font-medium text-text-muted mb-2">
              {{ 'budget.recurringForm.destination' | transloco }}
            </p>
            <div class="space-y-2" role="radiogroup" aria-labelledby="re-destination-label">
              <label class="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="radio"
                  name="destination"
                  class="accent-ib-red"
                  [checked]="destination() === 'third_party'"
                  (change)="destination.set('third_party')"
                />
                {{ 'budget.recurringForm.toThirdParty' | transloco }}
              </label>
              <label class="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
                <input
                  type="radio"
                  name="destination"
                  class="accent-ib-purple"
                  [checked]="destination() === 'my_account'"
                  (change)="destination.set('my_account')"
                />
                {{ 'budget.recurringForm.toMyAccount' | transloco }}
              </label>
            </div>
          </div>
        }

        <!-- Champs conditionnels selon le type -->
        @switch (activeType()) {
          @case ('income') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="re-day" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.recurringForm.incomeDay' | transloco
                }}</label>
                <input
                  id="re-day"
                  type="number"
                  formControlName="dayOfMonth"
                  min="1"
                  max="31"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                  [placeholder]="'budget.recurringForm.incomeDayPlaceholder' | transloco"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.recurringForm.incomeDayHint' | transloco }}
                </p>
              </div>
              <div>
                <label for="re-date" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.recurringForm.exactDate' | transloco
                }}</label>
                <input
                  id="re-date"
                  type="date"
                  formControlName="date"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.recurringForm.exactDateHint' | transloco }}
                </p>
              </div>
            </div>
          }
          @case ('expense') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="re-day" class="block text-sm font-medium text-text-muted mb-1"
                  >{{ 'budget.recurringForm.expenseDay' | transloco }}
                  <span aria-hidden="true">*</span></label
                >
                <input
                  id="re-day"
                  type="number"
                  formControlName="dayOfMonth"
                  min="1"
                  max="31"
                  aria-required="true"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                  [placeholder]="'budget.recurringForm.expenseDayPlaceholder' | transloco"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.recurringForm.expenseDayHint' | transloco }}
                </p>
              </div>
              <div>
                <label for="re-end-date" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.recurringForm.endDate' | transloco
                }}</label>
                <input
                  id="re-end-date"
                  type="date"
                  formControlName="endDate"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.recurringForm.endDateHint' | transloco }}
                </p>
              </div>
            </div>
          }
          @case ('annual_expense') {
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="re-date" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.recurringForm.annualDate' | transloco
                }}</label>
                <input
                  id="re-date"
                  type="date"
                  formControlName="date"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.recurringForm.annualDateHint' | transloco }}
                </p>
              </div>
              <div>
                <label for="re-end-date" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.recurringForm.endDate' | transloco
                }}</label>
                <input
                  id="re-end-date"
                  type="date"
                  formControlName="endDate"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                />
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.recurringForm.endDateHint' | transloco }}
                </p>
              </div>
            </div>
          }
          @case ('spending') {
            <div>
              <label for="re-date" class="block text-sm font-medium text-text-muted mb-1">{{
                'budget.recurringForm.spendingDate' | transloco
              }}</label>
              <input
                id="re-date"
                type="date"
                formControlName="date"
                class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
              />
              <p class="mt-1 text-xs text-text-muted">
                {{ 'budget.recurringForm.spendingDateHint' | transloco }}
              </p>
            </div>
          }
          @case ('transfer') {
            <div class="space-y-4">
              <!-- Toggle récurrent / ponctuel -->
              @if (showTransferModeToggle()) {
                <div>
                  <p class="text-xs font-medium text-text-muted mb-2">
                    {{ 'budget.recurringForm.transferType' | transloco }}
                  </p>
                  <div
                    class="flex rounded-lg border border-border overflow-hidden"
                    role="group"
                    [attr.aria-label]="'budget.recurringForm.transferTypeAria' | transloco"
                  >
                    <button
                      type="button"
                      class="flex-1 px-3 py-2 text-xs font-medium transition-colors"
                      [class.bg-ib-purple]="transferMode() === 'recurring'"
                      [class.text-canvas]="transferMode() === 'recurring'"
                      [class.text-text-muted]="transferMode() !== 'recurring'"
                      [attr.aria-pressed]="transferMode() === 'recurring'"
                      (click)="setTransferMode('recurring')"
                    >
                      {{ 'budget.recurringForm.transferRecurring' | transloco }}
                    </button>
                    <button
                      type="button"
                      class="flex-1 px-3 py-2 text-xs font-medium transition-colors border-l border-border"
                      [class.bg-ib-purple]="transferMode() === 'one_time'"
                      [class.text-canvas]="transferMode() === 'one_time'"
                      [class.text-text-muted]="transferMode() !== 'one_time'"
                      [attr.aria-pressed]="transferMode() === 'one_time'"
                      (click)="setTransferMode('one_time')"
                    >
                      {{ 'budget.recurringForm.transferOneTime' | transloco }}
                    </button>
                  </div>
                </div>
              }

              @if (accounts().length > 0) {
                <div>
                  <label for="re-to-account" class="block text-sm font-medium text-text-muted mb-1"
                    >{{ 'budget.recurringForm.toAccount' | transloco }}
                    <span aria-hidden="true">*</span></label
                  >
                  <select
                    id="re-to-account"
                    formControlName="toAccountId"
                    aria-required="true"
                    class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="">
                      {{ 'budget.recurringForm.toAccountChoose' | transloco }}
                    </option>
                    @for (acc of targetAccounts(); track acc.id) {
                      <option [value]="acc.id">{{ acc.name }}</option>
                    }
                  </select>
                  <p class="mt-1 text-xs text-text-muted">
                    {{ 'budget.recurringForm.toAccountHint' | transloco }}
                  </p>
                  @if (activeType() === 'transfer' && !form.controls.toAccountId.value) {
                    <small
                      data-testid="to-account-required"
                      class="mt-1 block text-xs text-ib-red"
                      role="alert"
                      >{{ 'budget.recurringForm.toAccountRequired' | transloco }}</small
                    >
                  }
                </div>
              }

              @if (transferMode() === 'recurring') {
                <div class="grid grid-cols-2 gap-4">
                  <div>
                    <label for="re-day" class="block text-sm font-medium text-text-muted mb-1">{{
                      'budget.recurringForm.transferDay' | transloco
                    }}</label>
                    <input
                      id="re-day"
                      type="number"
                      formControlName="dayOfMonth"
                      min="1"
                      max="31"
                      class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                      [placeholder]="'budget.recurringForm.transferDayPlaceholder' | transloco"
                    />
                    <p class="mt-1 text-xs text-text-muted">
                      {{ 'budget.recurringForm.transferDayHint' | transloco }}
                    </p>
                  </div>
                  <div>
                    <label
                      for="re-end-date"
                      class="block text-sm font-medium text-text-muted mb-1"
                      >{{ 'budget.recurringForm.endDate' | transloco }}</label
                    >
                    <input
                      id="re-end-date"
                      type="date"
                      formControlName="endDate"
                      class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                    />
                    <p class="mt-1 text-xs text-text-muted">
                      {{ 'budget.recurringForm.endDateHint' | transloco }}
                    </p>
                  </div>
                </div>
              } @else {
                <div>
                  <label for="re-date" class="block text-sm font-medium text-text-muted mb-1">{{
                    'budget.recurringForm.transferDate' | transloco
                  }}</label>
                  <input
                    id="re-date"
                    type="date"
                    formControlName="date"
                    class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                  />
                  <p class="mt-1 text-xs text-text-muted">
                    {{ 'budget.recurringForm.transferDateHint' | transloco }}
                  </p>
                </div>
              }
            </div>
          }
        }

        @if (
          activeType() === 'income' || activeType() === 'expense' || activeType() === 'transfer'
        ) {
          <label
            class="flex items-start gap-3 rounded-lg border border-border bg-raised px-3 py-2.5 cursor-pointer"
          >
            <input
              type="checkbox"
              formControlName="autoPost"
              class="mt-0.5 h-4 w-4 accent-ib-green"
            />
            <span class="text-sm">
              <span class="font-medium text-text-primary">{{
                'budget.recurringForm.autoPost' | transloco
              }}</span>
              <span class="block text-xs text-text-muted">{{
                'budget.recurringForm.autoPostHint' | transloco
              }}</span>
            </span>
          </label>
        }

        <div>
          <label for="re-category" class="block text-sm font-medium text-text-muted mb-1">{{
            'budget.recurringForm.category' | transloco
          }}</label>
          <input
            id="re-category"
            type="text"
            formControlName="category"
            list="re-category-options"
            class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            [placeholder]="'budget.recurringForm.categoryPlaceholder' | transloco"
          />
          <datalist id="re-category-options">
            @for (cat of categorySuggestions; track cat.key) {
              <option [value]="cat.label"></option>
            }
          </datalist>
        </div>

        @if (members().length > 0) {
          <div>
            <label for="re-member" class="block text-sm font-medium text-text-muted mb-1">{{
              'budget.recurringForm.member' | transloco
            }}</label>
            <select
              id="re-member"
              formControlName="memberId"
              class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            >
              <option value="">{{ 'budget.recurringForm.memberNone' | transloco }}</option>
              @for (m of members(); track m.id) {
                <option [value]="m.id">{{ m.firstName }} {{ m.lastName }}</option>
              }
            </select>
          </div>
        }

        <!-- Drag & drop fiche de paie (income only, edit mode) -->
        @if (showPayslipZone()) {
          <app-payslip-dropzone
            [hasExisting]="hasExistingPayslip()"
            [(pendingFile)]="pendingFile"
            (view)="viewPayslip.emit()"
            (remove)="removePayslip.emit()"
          />
        }
      </fieldset>

      <footer class="flex justify-end gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
          (click)="cancelled.emit()"
        >
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="submit"
          [disabled]="isInvalid()"
          class="rounded-lg bg-ib-green px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-green/90 transition-colors disabled:opacity-50"
        >
          {{
            initial()
              ? ('budget.recurringForm.submitEdit' | transloco)
              : ('budget.recurringForm.submitAdd' | transloco)
          }}
        </button>
      </footer>
    </form>
  `,
})
export class RecurringEntryForm {
  readonly initial = input<RecurringEntry | null>(null);
  readonly forcedType = input<RecurringEntryType | null>(null);
  readonly forcedAccountId = input<string | null>(null);
  readonly initialTransferMode = input<'recurring' | 'one_time'>('recurring');
  readonly accounts = input<BankAccount[]>([]);
  readonly members = input<Member[]>([]);
  readonly submitted = output<Omit<RecurringEntry, 'id'>>();
  readonly fileAttached = output<File>();
  readonly viewPayslip = output<void>();
  readonly removePayslip = output<void>();
  readonly cancelled = output<void>();

  protected readonly pendingFile = signal<File | null>(null);

  // Contexte prélèvement : un toggle Destination fait basculer expense ↔ transfer.
  protected readonly showDestinationToggle = computed(() =>
    destinationToggleVisible(this.forcedType() ?? this.initial()?.type),
  );

  // Sous-toggle récurrent/ponctuel : visible seulement pour le flux virement explicite
  // (bouton ponctuel du panneau, ou édition d'un virement) — masqué dans le flux prélèvement.
  protected readonly showTransferModeToggle = computed(() =>
    transferModeToggleVisible(this.forcedType() ?? this.initial()?.type),
  );

  protected readonly destination = linkedSignal<Destination>(() =>
    defaultDestination(this.forcedType() ?? this.initial()?.type),
  );

  protected readonly activeType = computed<RecurringEntryType>(() =>
    deriveActiveType({
      baseType: this.forcedType() ?? this.initial()?.type,
      destination: this.destination(),
    }),
  );

  // Mode virement : détecté depuis les données initiales, overridable par l'utilisateur
  protected readonly transferMode = linkedSignal<TransferMode>(() =>
    defaultTransferMode(this.initial(), this.initialTransferMode()),
  );

  // Comptes cibles pour les virements (exclut le compte source)
  protected readonly targetAccounts = computed(() =>
    targetAccountsFor(this.accounts(), this.forcedAccountId() ?? this.initial()?.accountId),
  );

  protected readonly showPayslipZone = computed(() =>
    payslipZoneVisible(this.forcedType() ?? this.initial()?.type, this.initial() !== null),
  );

  protected readonly hasExistingPayslip = computed(() => !!this.initial()?.payslipKey);

  // Suggestions de catégories connues (hors catégories internes auto : enveloppe/remboursement/autre).
  protected readonly categorySuggestions = BUDGET_CATEGORIES.filter(
    (c) => c.key !== 'other' && c.key !== 'envelope' && c.key !== 'repayment',
  );

  private readonly _i18n = inject(TranslocoService);
  protected readonly labelPlaceholder = computed(() => {
    switch (this.activeType()) {
      case 'income':
        return this._i18n.translate('budget.recurringForm.labelPlaceholderIncome');
      case 'expense':
        return this._i18n.translate('budget.recurringForm.labelPlaceholderExpense');
      case 'annual_expense':
        return this._i18n.translate('budget.recurringForm.labelPlaceholderAnnual');
      case 'spending':
        return this._i18n.translate('budget.recurringForm.labelPlaceholderSpending');
      case 'transfer':
        return this._i18n.translate('budget.recurringForm.labelPlaceholderTransfer');
      default:
        return this._i18n.translate('budget.recurringForm.labelPlaceholderDefault');
    }
  });

  protected readonly form = new FormGroup<RecurringEntryFormShape>({
    label: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0.01)],
    }),
    dayOfMonth: new FormControl<number | null>(null),
    date: new FormControl('', { nonNullable: true }),
    endDate: new FormControl('', { nonNullable: true }),
    toAccountId: new FormControl('', { nonNullable: true }),
    category: new FormControl('', { nonNullable: true }),
    memberId: new FormControl('', { nonNullable: true }),
    autoPost: new FormControl(false, { nonNullable: true }),
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
          label: data.label,
          amount: data.amount,
          dayOfMonth: data.dayOfMonth,
          date: data.date ?? '',
          endDate: data.endDate ?? '',
          toAccountId: data.toAccountId ?? '',
          category: data.category ?? '',
          memberId: data.memberId ?? '',
          autoPost: data.autoPost ?? false,
        });
      } else {
        this.form.reset();
      }
      this.pendingFile.set(null);
    });

    effect(() => {
      const ctrl = this.form.controls.toAccountId;
      if (this.activeType() === 'transfer') {
        ctrl.addValidators(Validators.required);
      } else {
        ctrl.removeValidators(Validators.required);
      }
      ctrl.updateValueAndValidity();
    });
  }

  protected setTransferMode(mode: 'recurring' | 'one_time') {
    this.transferMode.set(mode);
    if (mode === 'one_time') {
      this.form.controls.dayOfMonth.setValue(null);
      this.form.controls.endDate.setValue('');
    } else {
      this.form.controls.date.setValue('');
    }
  }

  protected submit() {
    if (this.form.invalid) return;

    const pending = this.pendingFile();
    if (pending) {
      this.fileAttached.emit(pending);
    }

    const month = new Date().toISOString().slice(0, 7);
    this.submitted.emit(
      buildRecurringEntryPayload(this.form.getRawValue(), {
        type: this.activeType(),
        initial: this.initial(),
        forcedAccountId: this.forcedAccountId(),
        currentMonth: month,
      }),
    );
  }
}
