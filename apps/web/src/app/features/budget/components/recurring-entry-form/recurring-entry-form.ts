import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { form, FormField, min, required, submit } from '@angular/forms/signals';
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

type RecurringEntryModel = {
  label: string;
  amount: number;
  dayOfMonth: number | null;
  date: string;
  endDate: string;
  toAccountId: string;
  category: string;
  memberId: string;
  autoPost: boolean;
};

const EMPTY_MODEL: RecurringEntryModel = {
  label: '',
  amount: 0,
  dayOfMonth: null,
  date: '',
  endDate: '',
  toAccountId: '',
  category: '',
  memberId: '',
  autoPost: false,
};

@Component({
  selector: 'app-recurring-entry-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormField, TranslocoPipe, PayslipDropzone],
  host: { class: 'block' },
  template: `
    <form (submit)="submitForm($event)" class="space-y-4">
      <fieldset class="space-y-4">
        <legend class="sr-only">{{ 'budget.recurringForm.legend' | transloco }}</legend>

        <div>
          <label for="re-label" class="block text-sm font-medium text-text-muted mb-1"
            >{{ 'budget.recurringForm.label' | transloco }} <span aria-hidden="true">*</span></label
          >
          <input
            id="re-label"
            type="text"
            [formField]="entryForm.label"
            aria-required="true"
            class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            [placeholder]="labelPlaceholder()"
          />
          @if (entryForm.label().touched() && entryForm.label().invalid()) {
            @for (err of entryForm.label().errors(); track err.message) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                err.message | transloco
              }}</small>
            }
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
            [formField]="entryForm.amount"
            step="0.01"
            aria-required="true"
            class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
            [placeholder]="'budget.recurringForm.amountPlaceholder' | transloco"
          />
          @if (entryForm.amount().touched() && entryForm.amount().invalid()) {
            @for (err of entryForm.amount().errors(); track err.message) {
              <small class="mt-1 block text-xs text-ib-red" role="alert">{{
                err.message | transloco
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
                  [formField]="entryForm.dayOfMonth"
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
                  [formField]="entryForm.date"
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
                  [formField]="entryForm.dayOfMonth"
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
                  [formField]="entryForm.endDate"
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
                  [formField]="entryForm.date"
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
                  [formField]="entryForm.endDate"
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
                [formField]="entryForm.date"
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
                    [formField]="entryForm.toAccountId"
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
                  @if (activeType() === 'transfer' && !model().toAccountId) {
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
                      [formField]="entryForm.dayOfMonth"
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
                      [formField]="entryForm.endDate"
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
                    [formField]="entryForm.date"
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

        @if (activeType() === 'income' || activeType() === 'expense') {
          <label
            class="flex items-start gap-3 rounded-lg border border-border bg-raised px-3 py-2.5 cursor-pointer"
          >
            <input type="checkbox" [formField]="entryForm.autoPost" class="mt-0.5 h-4 w-4 accent-ib-green" />
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
            [formField]="entryForm.category"
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
              [formField]="entryForm.memberId"
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
          [disabled]="entryForm().invalid()"
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

  // Réinitialisé quand `initial` change (deux-way avec la dropzone).
  protected readonly pendingFile = linkedSignal<File | null>(() => {
    this.initial();
    return null;
  });

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

  // Patch à l'édition / vide en création (remplace l'ancien effect de patchValue).
  protected readonly model = linkedSignal<RecurringEntryModel>(() => {
    const data = this.initial();
    return data
      ? {
          label: data.label,
          amount: data.amount,
          dayOfMonth: data.dayOfMonth,
          date: data.date ?? '',
          endDate: data.endDate ?? '',
          toAccountId: data.toAccountId ?? '',
          category: data.category ?? '',
          memberId: data.memberId ?? '',
          autoPost: data.autoPost ?? false,
        }
      : { ...EMPTY_MODEL };
  });

  // toAccountId requis uniquement en mode virement (remplace l'effect addValidators dynamique).
  protected readonly entryForm = form(this.model, (path) => {
    required(path.label, { message: 'budget.errors.labelRequired' });
    required(path.amount, { message: 'budget.errors.amountRequired' });
    min(path.amount, 0.01, { message: 'budget.errors.amountMin' });
    required(path.toAccountId, {
      when: () => this.activeType() === 'transfer',
      message: 'budget.recurringForm.toAccountRequired',
    });
  });

  protected setTransferMode(mode: 'recurring' | 'one_time') {
    this.transferMode.set(mode);
    if (mode === 'one_time') {
      this.model.update((m) => ({ ...m, dayOfMonth: null, endDate: '' }));
    } else {
      this.model.update((m) => ({ ...m, date: '' }));
    }
  }

  protected async submitForm(event?: Event): Promise<void> {
    event?.preventDefault();
    await submit(this.entryForm, async () => {
      const pending = this.pendingFile();
      if (pending) {
        this.fileAttached.emit(pending);
      }
      const month = new Date().toISOString().slice(0, 7);
      this.submitted.emit(
        buildRecurringEntryPayload(this.model(), {
          type: this.activeType(),
          initial: this.initial(),
          forcedAccountId: this.forcedAccountId(),
          currentMonth: month,
        }),
      );
      return [];
    });
  }
}
