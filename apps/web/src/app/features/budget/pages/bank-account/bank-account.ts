import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import { BankAccount as BankAccountModel, BankAccountType, BANK_ACCOUNT_TYPES } from '../../domain/models/bank-account.model';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { AccountTransaction } from '../../domain/models/account-transaction.model';
import { confirmedBalance as computeConfirmedBalance, isRecurrencePosted } from '../../domain/account-balance';
import { addMoney } from '../../domain/money';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { RecurringEntryForm } from '../../components/recurring-entry-form/recurring-entry-form';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { BankKpiGrid } from './bank-kpi-grid/bank-kpi-grid';
import { BudgetUsageBar } from './budget-usage-bar/budget-usage-bar';
import { BankIncomesTable } from './bank-incomes-table/bank-incomes-table';
import { BankExpenseColumns } from './bank-expense-columns/bank-expense-columns';
import { BankTransfersPanel } from './bank-transfers-panel/bank-transfers-panel';
import { BankTimeline } from './bank-timeline/bank-timeline';

const PALETTE = [
  'var(--color-ib-blue)',
  'var(--color-ib-cyan)',
  'var(--color-ib-green)',
  'var(--color-ib-purple)',
  'var(--color-ib-orange)',
  'var(--color-ib-pink)',
  'var(--color-ib-yellow)',
  'var(--color-ib-red)',
] as const;

const sumAmount = (entries: readonly RecurringEntry[]): number =>
  entries.reduce((s, e) => s + Number(e.amount), 0);

@Component({
  selector: 'app-bank-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalDialog, RecurringEntryForm, Icon, BankKpiGrid, BudgetUsageBar, BankIncomesTable, BankExpenseColumns, BankTransfersPanel, BankTimeline, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">{{ 'budget.bankAccount.title' | transloco }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'budget.bankAccount.subtitle' | transloco }}</p>
      </div>
      <nav class="flex items-center gap-2 flex-wrap" [attr.aria-label]="'budget.bankAccount.accountNavAria' | transloco">
        @if (accounts().length > 1) {
          <button type="button"
                  class="inline-flex items-center rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition-colors"
                  [class.border-ib-blue]="selectedAccountId() === null"
                  [class.bg-ib-blue]="selectedAccountId() === null"
                  [class.text-canvas]="selectedAccountId() === null"
                  [class.border-border]="selectedAccountId() !== null"
                  [class.text-text-muted]="selectedAccountId() !== null"
                  (click)="selectAccount(null)">
            {{ 'budget.bankAccount.allAccounts' | transloco }}
          </button>
        }
        @for (da of decoratedAccounts(); track da.account.id) {
          <button type="button"
                  class="inline-flex items-center gap-2 rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition"
                  [style.border-color]="selectedAccountId() === da.account.id ? da.color : 'var(--border)'"
                  [style.background-color]="selectedAccountId() === da.account.id ? da.color : 'transparent'"
                  [class.text-canvas]="selectedAccountId() === da.account.id"
                  [class.text-text-muted]="selectedAccountId() !== da.account.id"
                  (click)="selectAccount(da.account.id)">
            <span class="inline-block h-2.5 w-2.5 rounded-full"
                  [style.background-color]="da.dot"></span>
            {{ da.account.name }}
          </button>
        }
        <button type="button"
                class="rounded-lg border border-dashed border-border min-h-8 px-3 py-1.5 text-xs text-text-muted hover:border-ib-cyan/50 hover:text-ib-cyan transition-colors"
                (click)="accountModalRef().open()">
          <app-icon name="settings" size="12" class="inline -mt-0.5" /> {{ 'budget.bankAccount.manage' | transloco }}
        </button>
      </nav>
    </header>

    <!-- ═══ KPI Cards ═══ -->
    <app-bank-kpi-grid
      [currentBalance]="confirmedBalance()"
      [totalIncome]="totalIncome()"
      [totalMonthlyExpenses]="totalMonthlyExpenses()"
      [totalAnnualExpenses]="totalAnnualExpenses()"
      [monthlyAnnualExpenses]="monthlyAnnualExpenses()"
      [totalMonthSpendings]="totalMonthSpendings()"
      [endOfMonthBalance]="projectedBalance()"
      [today]="today"
      [incomesLabel]="incomesLabel()"
      [monthlyExpensesLabel]="monthlyExpensesLabel()"
      [monthSpendingsLabel]="monthSpendingsLabel()" />

    <!-- ═══ Barre de progression ═══ -->
    <app-budget-usage-bar
      [totalIncome]="totalIncome()"
      [totalAllExpenses]="totalAllExpenses()"
      [usagePercent]="usagePercent()"
      [totalPassedExpenses]="totalPassedExpenses()"
      [totalUpcomingExpenses]="totalUpcomingExpenses()"
      [monthlyAnnualExpenses]="monthlyAnnualExpenses()"
      [totalMonthSpendings]="totalMonthSpendings()" />

    <!-- ═══ Revenus ═══ -->
    <app-bank-incomes-table
      [incomes]="incomes()"
      [memberMap]="memberMap()"
      (create)="openCreateModal('income')"
      (edit)="openEditModal($event)"
      (delete)="deleteEntry($event)"
      (openPayslip)="openPayslipById($event)" />

    <!-- ═══ 3 colonnes : Prélèvements / Annuels / Dépenses ═══ -->
    <app-bank-expense-columns
      [monthlyExpenses]="sortedMonthlyExpenses()"
      [annualExpenses]="annualExpenses()"
      [monthSpendings]="monthSpendings()"
      [totalMonthlyExpenses]="totalMonthlyExpenses()"
      [totalAnnualExpenses]="totalAnnualExpenses()"
      [monthlyAnnualExpenses]="monthlyAnnualExpenses()"
      [totalMonthSpendings]="totalMonthSpendings()"
      [spendingMonthLabel]="spendingMonthLabel()"
      [memberMap]="memberMap()"
      [isExpensePassed]="isExpensePassedFn"
      (createMonthly)="openCreateModal('expense')"
      (createAnnual)="openCreateModal('annual_expense')"
      (createSpending)="openCreateModal('spending')"
      (edit)="openEditModal($event)"
      (delete)="deleteEntry($event)"
      (prevMonth)="prevMonth()"
      (nextMonth)="nextMonth()" />

    <!-- ═══ Virements ═══ -->
    <app-bank-transfers-panel
      [recurringTransfers]="recurringTransfers()"
      [monthOneTimeTransfers]="monthOneTimeTransfers()"
      [totalOneTimeOutgoing]="totalOneTimeOutgoing()"
      [totalOneTimeIncoming]="totalOneTimeIncoming()"
      [selectedAccountId]="selectedAccountId()"
      [memberMap]="memberMap()"
      [accountNameById]="accountNameByIdFn"
      [isExpensePassed]="isExpensePassedFn"
      [spendingMonthLabel]="spendingMonthLabel()"
      [accountsCount]="accounts().length"
      (createRecurring)="openCreateModal('transfer', 'recurring')"
      (createOneTime)="openCreateModal('transfer', 'one_time')"
      (edit)="openEditModal($event)"
      (delete)="deleteEntry($event)"
      (prevMonth)="prevMonth()"
      (nextMonth)="nextMonth()" />

    <!-- ═══ Timeline du mois ═══ -->
    <app-bank-timeline
      [timelineEvents]="timelineEvents()"
      [currentDay]="currentDay"
      [currentBalance]="confirmedBalance()" />

    <!-- ═══ Modals ═══ -->
    <app-modal-dialog #accountModal [title]="'budget.bankAccount.accountModal.title' | transloco" (closed)="resetAccountForm()">
      @if (accountModal.isOpen()) {
        <div class="space-y-6">
          @if (accounts().length > 0) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">{{ 'budget.bankAccount.accountModal.existing' | transloco }}</p>
              <div class="rounded-xl border border-border overflow-hidden divide-y divide-border/30">
                @for (da of decoratedAccounts(); track da.account.id) {
                  <div class="px-4 py-3 hover:bg-hover/30 transition-colors space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex items-center gap-2">
                          <span class="inline-block h-3 w-3 rounded-full" [style.background-color]="da.dot"></span>
                          <span class="inline-block h-4 w-4 rounded-md" [style.background-color]="da.color"></span>
                        </span>
                        <input type="text"
                               class="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-text-primary hover:border-border focus:border-border focus:bg-raised focus-visible:outline-none"
                               [value]="da.account.name"
                               [attr.aria-label]="'budget.bankAccount.accountModal.renameAria' | transloco: { name: da.account.name }"
                               (change)="updateAccountName(da.account, $event)" />
                      </div>
                      <button type="button"
                              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                              [title]="'budget.bankAccount.accountModal.deleteTitle' | transloco: { name: da.account.name }"
                              [attr.aria-label]="'budget.bankAccount.accountModal.deleteAria' | transloco: { name: da.account.name }"
                              (click)="deleteAccount(da.account)">
                        <app-icon name="trash" size="14" />
                      </button>
                    </div>
                    <div class="flex items-center gap-2 pl-10">
                      <label class="text-[11px] text-text-muted whitespace-nowrap">{{ 'budget.bankAccount.accountModal.currentBalance' | transloco }}</label>
                      <input type="number" step="0.01"
                             class="w-32 rounded-lg border border-border bg-raised px-2 py-1 text-xs font-mono text-text-primary text-right"
                             [value]="da.account.initialBalance"
                             (change)="updateAccountBalance(da.account, $event)" />
                      <span class="text-[11px] text-text-muted">&euro;</span>
                    </div>
                    <div class="flex items-center gap-2 pl-10">
                      <label class="text-[11px] text-text-muted whitespace-nowrap">{{ 'budget.bankAccount.accountModal.type' | transloco }}</label>
                      <select class="rounded-lg border border-border bg-raised px-2 py-1 text-xs text-text-primary"
                              [value]="da.account.type" (change)="updateAccountType(da.account, $event)"
                              [attr.aria-label]="'budget.bankAccount.accountModal.typeAria' | transloco: { name: da.account.name }">
                        @for (t of ACCOUNT_TYPES; track t) {
                          <option [value]="t">{{ ('budget.bankAccount.type.' + t) | transloco }}</option>
                        }
                      </select>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">{{ 'budget.bankAccount.accountModal.addAccount' | transloco }}</p>
            <form (ngSubmit)="createAccount()" class="space-y-3">
              <div>
                <label for="acc-name" class="block text-sm font-medium text-text-muted mb-1">{{ 'budget.bankAccount.accountModal.name' | transloco }} <span aria-hidden="true">*</span></label>
                <input id="acc-name" type="text" [ngModel]="newAccountName()" (ngModelChange)="newAccountName.set($event)" name="name"
                       class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                       [placeholder]="'budget.bankAccount.accountModal.namePlaceholder' | transloco" />
              </div>
              <div>
                <label for="acc-type" class="block text-sm font-medium text-text-muted mb-1">{{ 'budget.bankAccount.accountModal.type' | transloco }}</label>
                <select id="acc-type" [ngModel]="newAccountType()" (ngModelChange)="newAccountType.set($event)" name="type"
                        class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary">
                  @for (t of ACCOUNT_TYPES; track t) {
                    <option [ngValue]="t">{{ ('budget.bankAccount.type.' + t) | transloco }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="acc-balance" class="block text-sm font-medium text-text-muted mb-1">{{ 'budget.bankAccount.accountModal.initialBalance' | transloco }}</label>
                <div class="relative">
                  <input id="acc-balance" type="number" step="0.01" [ngModel]="newAccountBalance()" (ngModelChange)="newAccountBalance.set($event)" name="balance"
                         class="w-full rounded-lg border border-border bg-raised px-3 py-2 pr-8 text-sm font-mono text-text-primary"
                         placeholder="0.00" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">&euro;</span>
                </div>
                <p class="mt-1 text-xs text-text-muted">{{ 'budget.bankAccount.accountModal.balanceHint' | transloco }}</p>
              </div>
              <p class="text-xs text-text-muted">{{ 'budget.bankAccount.accountModal.colorsAuto' | transloco }}</p>
              <footer class="flex justify-end gap-3 pt-2">
                <button type="button"
                        class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
                        (click)="accountModalRef().close()">
                  {{ 'common.close' | transloco }}
                </button>
                <button type="submit" [disabled]="!newAccountName().trim()"
                        class="rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-cyan/90 transition-colors disabled:opacity-50">
                  {{ 'budget.actions.add' | transloco }}
                </button>
              </footer>
            </form>
          </div>
        </div>
      }
    </app-modal-dialog>

    <app-modal-dialog #createModal [title]="createModalTitle()" (closed)="onModalClosed()">
      @if (createModal.isOpen()) {
        <app-recurring-entry-form [forcedType]="createType()" [forcedAccountId]="selectedAccountId()" [initialTransferMode]="createTransferMode()" [accounts]="accounts()" [members]="members()" (submitted)="createEntry($event)" (cancelled)="createModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal [title]="editModalTitle()" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-recurring-entry-form [initial]="selectedEntry()" [accounts]="accounts()" [members]="members()"
          (submitted)="updateEntry($event)"
          (fileAttached)="uploadPayslip($event)"
          (viewPayslip)="openPayslip()"
          (removePayslip)="deletePayslip()"
          (cancelled)="editModal.close()" />
      }
    </app-modal-dialog>
  `,
})
export class BankAccount {
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly accountGateway = inject(BankAccountGateway);
  private readonly memberGateway = inject(MemberGateway);
  private readonly archiveGateway = inject(SalaryArchiveGateway);
  private readonly txGateway = inject(AccountTransactionGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  protected readonly accountModalRef = viewChild.required<ModalDialog>('accountModal');

  private readonly _refresh = signal(0);
  private readonly _refreshAccounts = signal(0);

  private readonly allEntries = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.entryGateway.getAll())),
    { initialValue: [] },
  );

  protected readonly accounts = toSignal(
    toObservable(this._refreshAccounts).pipe(switchMap(() => this.accountGateway.getAll())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.memberGateway.getAll(), { initialValue: [] });

  private readonly allTx = toSignal(this.txGateway.getAll(), { initialValue: [] as AccountTransaction[] });
  private readonly todayIso = new Date().toISOString().slice(0, 10);

  protected readonly selectedAccountId = linkedSignal<string | null>(() => {
    const accs = this.accounts();
    return accs.length > 0 ? accs[0].id : null;
  });

  protected readonly filteredEntries = computed(() => {
    const accountId = this.selectedAccountId();
    const all = this.allEntries();
    if (accountId === null) return all;
    return all.filter(e => e.accountId === accountId);
  });

  private readonly currentMonth = new Date().toISOString().slice(0, 7);

  private isActive(entry: RecurringEntry): boolean {
    if (!entry.endDate) return true;
    return entry.endDate.slice(0, 7) >= this.currentMonth;
  }

  protected readonly incomes = computed(() => this.filteredEntries().filter(e => e.type === 'income' && this.isActive(e)));
  protected readonly monthlyExpenses = computed(() => this.filteredEntries().filter(e => e.type === 'expense' && this.isActive(e)));
  protected readonly annualExpenses = computed(() => this.filteredEntries().filter(e => e.type === 'annual_expense' && this.isActive(e)));
  protected readonly allSpendings = computed(() => this.filteredEntries().filter(e => e.type === 'spending'));

  protected readonly transfers = computed(() => {
    const accountId = this.selectedAccountId();
    const all = this.allEntries().filter(e => e.type === 'transfer' && this.isActive(e));
    if (accountId === null) return all;
    return all.filter(e => e.accountId === accountId || e.toAccountId === accountId);
  });

  protected readonly recurringTransfers = computed(() =>
    this.transfers().filter(e => e.dayOfMonth != null)
  );

  protected readonly oneTimeTransfers = computed(() =>
    this.transfers().filter(e => !e.dayOfMonth && !!e.date)
  );

  protected readonly monthOneTimeTransfers = computed(() => {
    const ym = this.spendingMonth();
    return this.oneTimeTransfers()
      .filter(e => e.date!.startsWith(ym))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  private readonly outgoingTransfers = computed(() => {
    const accountId = this.selectedAccountId();
    return this.recurringTransfers().filter(e => e.accountId === accountId);
  });

  private readonly incomingTransfers = computed(() => {
    const accountId = this.selectedAccountId();
    return this.recurringTransfers().filter(e => e.toAccountId === accountId);
  });

  protected readonly spendingMonth = signal(new Date().toISOString().slice(0, 7));

  protected readonly spendingMonthLabel = computed(() => {
    const [y, m] = this.spendingMonth().split('-');
    const monthKeys = ['janv', 'fevr', 'mars', 'avril', 'mai', 'juin', 'juil', 'aout', 'sept', 'oct', 'nov', 'dec'];
    const monthLabel = this._i18n.translate(`budget.common.month.${monthKeys[Number(m) - 1]}`);
    return `${monthLabel} ${y}`;
  });

  protected readonly incomesLabel = computed(() => {
    const list = this.incomes();
    if (list.length === 1) return list[0].label;
    return this._i18n.translate('budget.bankAccount.kpi.incomeSources', { count: list.length });
  });

  protected readonly monthlyExpensesLabel = computed(() =>
    this._i18n.translate('budget.bankAccount.kpi.directDebitsLabel', {
      passed: this.passedExpenses().length,
      total: this.monthlyExpenses().length,
    }),
  );

  protected readonly monthSpendingsLabel = computed(() => {
    const count = this.monthSpendings().length;
    const key = count > 1 ? 'budget.bankAccount.kpi.spendingCountPlural' : 'budget.bankAccount.kpi.spendingCount';
    return this._i18n.translate(key, { count, month: this.spendingMonthLabel() });
  });

  protected readonly monthSpendings = computed(() => {
    const ym = this.spendingMonth();
    return this.allSpendings()
      .filter(e => {
        if (!e.date) return true;
        return e.date.startsWith(ym);
      })
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  protected readonly sortedMonthlyExpenses = computed(() =>
    [...this.monthlyExpenses()].sort((a, b) => (a.dayOfMonth ?? 32) - (b.dayOfMonth ?? 32))
  );

  protected readonly today = new Date().toLocaleDateString(this._i18n.getActiveLang() === 'en' ? 'en-US' : 'fr-FR', { day: 'numeric', month: 'short' });
  protected readonly currentDay = new Date().getDate();

  protected readonly salaryDay = computed(() => {
    const firstIncome = this.incomes().find(e => e.dayOfMonth);
    return firstIncome?.dayOfMonth ?? 1;
  });

  // Un prélèvement est "passé" dans le cycle salaire → salaire
  // Ex: salaire le 25, aujourd'hui le 3 → passés = jours 25-31 + 1-3
  // Ex: salaire le 5, aujourd'hui le 20 → passés = jours 5-20
  protected isExpensePassed(entry: RecurringEntry): boolean {
    const day = entry.dayOfMonth ?? 1;
    const salary = this.salaryDay();
    const today = this.currentDay;

    if (today >= salary) {
      // Cycle dans le même mois : passé si entre salaryDay et today
      return day >= salary && day <= today;
    }
    // Cycle à cheval sur 2 mois : passé si >= salaryDay OU <= today
    return day >= salary || day <= today;
  }

  // Bound function references for child components (kept stable)
  protected readonly isExpensePassedFn = (entry: RecurringEntry) => this.isExpensePassed(entry);
  protected readonly accountNameByIdFn = (id: string | null) => this.accountNameById(id);

  protected readonly selectedAccount = computed(() => {
    const id = this.selectedAccountId();
    return this.accounts().find(a => a.id === id) ?? null;
  });

  protected readonly selectedInitialBalance = computed(() =>
    Number(this.selectedAccount()?.initialBalance ?? 0)
  );

  protected readonly accountRealTxs = computed(() => {
    const id = this.selectedAccountId();
    const txs = this.allTx();
    if (id === null) return txs;
    return txs.filter((t) => t.accountId === id || t.toAccountId === id);
  });

  protected readonly confirmedBalance = computed(() => {
    const acc = this.selectedAccount();
    if (acc) return computeConfirmedBalance(acc, this.accountRealTxs(), this.todayIso);
    const txs = this.allTx();
    return this.accounts().reduce(
      (sum, a) => addMoney(sum, computeConfirmedBalance(a, txs.filter((t) => t.accountId === a.id || t.toAccountId === a.id), this.todayIso)),
      0,
    );
  });

  private readonly isUnposted = (e: RecurringEntry): boolean =>
    !isRecurrencePosted(e.id, this.currentMonth, this.accountRealTxs());

  // Delta des récurrences = formule de endOfMonthBalance SANS le solde initial,
  // chaque somme excluant les récurrences déjà postées (réconciliées avec une transaction réelle).
  protected readonly forecastDelta = computed(() => {
    const inc = sumAmount(this.incomes().filter(this.isUnposted));
    const exp = sumAmount(this.monthlyExpenses().filter(this.isUnposted));
    const ann = sumAmount(this.annualExpenses().filter(this.isUnposted)) / 12;
    const spend = sumAmount(this.monthSpendings().filter(this.isUnposted));
    const inTransfers = sumAmount(this.incomingTransfers().filter(this.isUnposted)) + this.totalOneTimeIncoming();
    const outTransfers = sumAmount(this.outgoingTransfers().filter(this.isUnposted)) + this.totalOneTimeOutgoing();
    return inc + inTransfers - exp - ann - spend - outTransfers;
  });

  protected readonly projectedBalance = computed(() => this.confirmedBalance() + this.forecastDelta());

  protected readonly totalIncome = computed(() => sumAmount(this.incomes()));
  protected readonly totalMonthlyExpenses = computed(() => sumAmount(this.monthlyExpenses()));
  protected readonly totalAnnualExpenses = computed(() => sumAmount(this.annualExpenses()));
  protected readonly monthlyAnnualExpenses = computed(() => this.totalAnnualExpenses() / 12);
  protected readonly totalMonthSpendings = computed(() => sumAmount(this.monthSpendings()));

  // Prélèvements passés/à venir dans le cycle salaire
  protected readonly passedExpenses = computed(() =>
    this.monthlyExpenses().filter(e => this.isExpensePassed(e))
  );
  protected readonly upcomingExpenses = computed(() =>
    this.monthlyExpenses().filter(e => !this.isExpensePassed(e))
  );
  protected readonly totalPassedExpenses = computed(() => sumAmount(this.passedExpenses()));
  protected readonly totalUpcomingExpenses = computed(() => sumAmount(this.upcomingExpenses()));

  // Virements ponctuels sortants/entrants du mois (tous considérés comme passés)
  protected readonly totalOneTimeOutgoing = computed(() =>
    sumAmount(this.monthOneTimeTransfers().filter(e => e.accountId === this.selectedAccountId()))
  );
  protected readonly totalOneTimeIncoming = computed(() =>
    sumAmount(this.monthOneTimeTransfers().filter(e => e.toAccountId === this.selectedAccountId()))
  );

  private readonly passedOutgoing = computed(() =>
    sumAmount(this.outgoingTransfers().filter(e => this.isExpensePassed(e))) + this.totalOneTimeOutgoing()
  );
  private readonly passedIncoming = computed(() =>
    sumAmount(this.incomingTransfers().filter(e => this.isExpensePassed(e))) + this.totalOneTimeIncoming()
  );
  private readonly totalOutgoing = computed(() =>
    sumAmount(this.outgoingTransfers()) + this.totalOneTimeOutgoing()
  );
  private readonly totalIncoming = computed(() =>
    sumAmount(this.incomingTransfers()) + this.totalOneTimeIncoming()
  );

  protected readonly totalAllExpenses = computed(() =>
    this.totalMonthlyExpenses() + this.monthlyAnnualExpenses() + this.totalMonthSpendings() + this.totalOutgoing()
  );

  protected readonly usagePercent = computed(() => {
    const income = this.totalIncome() + this.selectedInitialBalance() + this.totalIncoming();
    if (income === 0) return 0;
    return (this.totalAllExpenses() / income) * 100;
  });

  protected readonly selectedEntry = signal<RecurringEntry | null>(null);
  protected readonly createType = signal<RecurringEntryType>('income');
  protected readonly createTransferMode = signal<'recurring' | 'one_time'>('recurring');
  // Timeline du mois : tous les événements triés par cycle salaire
  protected readonly timelineEvents = computed(() => {
    const salary = this.salaryDay();
    const events: { id: string; day: number; label: string; amount: number; sign: string; type: RecurringEntryType; passed: boolean }[] = [];

    for (const e of this.incomes()) {
      if (e.dayOfMonth) events.push({ id: e.id, day: e.dayOfMonth, label: e.label, amount: Number(e.amount), sign: '+', type: 'income', passed: this.isExpensePassed(e) });
    }
    for (const e of this.monthlyExpenses()) {
      const day = e.dayOfMonth ?? 1;
      events.push({ id: e.id, day, label: e.label, amount: Number(e.amount), sign: '-', type: 'expense', passed: this.isExpensePassed(e) });
    }
    const fallback = this._i18n.translate('budget.bankAccount.timelineFallback');
    for (const e of this.outgoingTransfers()) {
      events.push({ id: e.id, day: e.dayOfMonth ?? 1, label: `→ ${this.accountNameById(e.toAccountId) ?? fallback} — ${e.label}`, amount: Number(e.amount), sign: '-', type: 'transfer', passed: this.isExpensePassed(e) });
    }
    for (const e of this.incomingTransfers()) {
      events.push({ id: e.id + '-in', day: e.dayOfMonth ?? 1, label: `← ${this.accountNameById(e.accountId) ?? fallback} — ${e.label}`, amount: Number(e.amount), sign: '+', type: 'transfer', passed: this.isExpensePassed(e) });
    }

    // Tri dans l'ordre du cycle salaire (salaryDay en premier)
    return events.sort((a, b) => {
      const orderA = a.day >= salary ? a.day - salary : a.day + 31 - salary;
      const orderB = b.day >= salary ? b.day - salary : b.day + 31 - salary;
      return orderA - orderB;
    });
  });

  protected readonly createModalTitle = computed(() => {
    switch (this.createType()) {
      case 'income': return this._i18n.translate('budget.bankAccount.createTitles.income');
      case 'expense': return this._i18n.translate('budget.bankAccount.createTitles.expense');
      case 'annual_expense': return this._i18n.translate('budget.bankAccount.createTitles.annualExpense');
      case 'spending': return this._i18n.translate('budget.bankAccount.createTitles.spending');
      case 'transfer': return this._i18n.translate(this.createTransferMode() === 'one_time' ? 'budget.bankAccount.createTitles.transferOneTime' : 'budget.bankAccount.createTitles.transferRecurring');
    }
  });
  protected readonly editModalTitle = computed(() => {
    switch (this.selectedEntry()?.type) {
      case 'income': return this._i18n.translate('budget.bankAccount.editTitles.income');
      case 'expense': return this._i18n.translate('budget.bankAccount.editTitles.expense');
      case 'annual_expense': return this._i18n.translate('budget.bankAccount.editTitles.annualExpense');
      case 'spending': return this._i18n.translate('budget.bankAccount.editTitles.spending');
      case 'transfer': return this._i18n.translate('budget.bankAccount.editTitles.transfer');
      default: return this._i18n.translate('budget.bankAccount.editTitles.default');
    }
  });

  protected readonly newAccountName = signal('');
  protected readonly newAccountType = signal<BankAccountType>('courant');
  protected readonly newAccountBalance = signal<number>(0);
  protected readonly ACCOUNT_TYPES = BANK_ACCOUNT_TYPES;

  protected readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string }>();
    const members = this.members();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      map.set(m.id, { name: `${m.firstName} ${m.lastName}`, color: PALETTE[(i + 3) % PALETTE.length] });
    }
    return map;
  });

  protected readonly decoratedAccounts = computed(() =>
    this.accounts().map((account, i) => ({
      account,
      color: PALETTE[i % PALETTE.length],
      dot: PALETTE[(i + 3) % PALETTE.length],
    })),
  );

  private readonly accountMap = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.accounts()) {
      map.set(a.id, a.name);
    }
    return map;
  });

  protected accountNameById(id: string | null): string | null {
    if (!id) return null;
    return this.accountMap().get(id) ?? null;
  }

  protected selectAccount(id: string | null) {
    this.selectedAccountId.set(id);
  }

  private shiftMonth(delta: number) {
    const [y, m] = this.spendingMonth().split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    this.spendingMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  protected prevMonth() {
    this.shiftMonth(-1);
  }

  protected nextMonth() {
    this.shiftMonth(1);
  }

  protected resetAccountForm() {
    this.newAccountName.set('');
    this.newAccountType.set('courant');
    this.newAccountBalance.set(0);
  }

  protected async createAccount() {
    const name = this.newAccountName().trim();
    if (!name) return;
    try {
      await lastValueFrom(this.accountGateway.create({ name, type: this.newAccountType(), initialBalance: this.newAccountBalance(), color: null, dotColor: null }));
      this.toaster.success(this._i18n.translate('budget.bankAccount.messages.accountCreated'));
      this.resetAccountForm();
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error(this._i18n.translate('budget.bankAccount.messages.accountCreateError'));
    }
  }

  // En E2EE, l'update remplace tout le blob chiffré → on renvoie TOUJOURS le compte complet
  // (sinon un update partiel écraserait name/type/color). `changes` ne modifie qu'un champ.
  private async persistAccount(account: BankAccountModel, changes: Partial<Omit<BankAccountModel, 'id'>>, successKey: string, errorKey: string) {
    try {
      await lastValueFrom(this.accountGateway.update(account.id, {
        name: account.name,
        type: account.type,
        initialBalance: account.initialBalance,
        color: account.color,
        dotColor: account.dotColor,
        ...changes,
      }));
      this.toaster.success(this._i18n.translate(successKey));
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error(this._i18n.translate(errorKey));
    }
  }

  protected updateAccountBalance(account: BankAccountModel, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    return this.persistAccount(account, { initialBalance: value }, 'budget.bankAccount.messages.balanceUpdated', 'budget.bankAccount.messages.balanceUpdateError');
  }

  protected updateAccountName(account: BankAccountModel, event: Event) {
    const name = (event.target as HTMLInputElement).value.trim();
    if (!name) {
      this._refreshAccounts.update(v => v + 1); // annule la saisie vide
      return;
    }
    return this.persistAccount(account, { name }, 'budget.bankAccount.messages.nameUpdated', 'budget.bankAccount.messages.nameUpdateError');
  }

  protected updateAccountType(account: BankAccountModel, event: Event) {
    const type = (event.target as HTMLSelectElement).value as BankAccountType;
    return this.persistAccount(account, { type }, 'budget.bankAccount.messages.typeUpdated', 'budget.bankAccount.messages.typeUpdateError');
  }

  protected async deleteAccount(account: BankAccountModel) {
    if (!await this.confirm.confirm({
      title: this._i18n.translate('budget.bankAccount.messages.accountDeleteConfirmTitle'),
      message: this._i18n.translate('budget.bankAccount.messages.accountDeleteConfirmMessage', { name: account.name }),
      confirmLabel: this._i18n.translate('budget.actions.delete'),
      variant: 'danger',
    })) return;
    try {
      await lastValueFrom(this.accountGateway.delete(account.id));
      this.toaster.success(this._i18n.translate('budget.bankAccount.messages.accountDeleted'));
      if (this.selectedAccountId() === account.id) {
        this.selectedAccountId.set(null);
      }
      this._refreshAccounts.update(v => v + 1);
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error(this._i18n.translate('budget.bankAccount.messages.accountDeleteError'));
    }
  }

  protected openCreateModal(type: RecurringEntryType, transferMode: 'recurring' | 'one_time' = 'recurring') {
    this.createType.set(type);
    this.createTransferMode.set(transferMode);
    this.createModalRef().open();
  }

  protected openEditModal(entry: RecurringEntry) {
    this.selectedEntry.set(entry);
    this.editModalRef().open();
  }

  protected onModalClosed() { this.selectedEntry.set(null); }

  protected async createEntry(data: Omit<RecurringEntry, 'id'>) {
    try {
      // Si c'est un revenu et qu'il en existe déjà, demander à l'utilisateur
      if (data.type === 'income' && this.incomes().length > 0) {
        const choice = await this.confirm.choose({
          title: this._i18n.translate('budget.bankAccount.messages.addIncomeTitle'),
          message: this._i18n.translate('budget.bankAccount.messages.addIncomeMessage'),
          confirmLabel: this._i18n.translate('budget.bankAccount.messages.newCycle'),
          alternativeLabel: this._i18n.translate('budget.bankAccount.messages.addToMonth'),
          cancelLabel: this._i18n.translate('common.cancel'),
          variant: 'info',
        });

        if (choice === 'cancel') return;

        if (choice === 'confirm') {
          await this.archiveCurrentCycle();
          for (const old of this.incomes()) {
            await lastValueFrom(this.entryGateway.delete(old.id));
          }
          this.toaster.success(this._i18n.translate('budget.bankAccount.messages.cycleArchived'));
        }
      }

      await lastValueFrom(this.entryGateway.create(data));
      this.toaster.success(this._i18n.translate('budget.bankAccount.messages.entryCreated'));
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error(this._i18n.translate('budget.bankAccount.messages.entryCreateError'));
    }
  }

  private async archiveCurrentCycle() {
    const salary = this.totalIncome();
    if (salary <= 0) return;

    const month = new Date().toISOString().slice(0, 7);
    const accountId = this.selectedAccountId();
    const totalExpenses = this.totalMonthlyExpenses() + this.monthlyAnnualExpenses();
    const totalSpendings = this.totalMonthSpendings();
    const spendings = this.monthSpendings().map(e => ({
      label: e.label,
      amount: Number(e.amount),
      date: e.date,
      category: e.category,
    }));

    const fd = new FormData();
    fd.append('month', month);
    fd.append('salary', String(salary));
    fd.append('totalExpenses', String(totalExpenses));
    fd.append('totalSpendings', String(totalSpendings));
    fd.append('spendings', JSON.stringify(spendings));
    if (accountId) fd.append('accountId', accountId);

    try {
      await lastValueFrom(this.archiveGateway.create(fd));
    } catch {
      // L'archivage silencieux échoue — on continue quand même
    }
  }

  protected async deleteEntry(id: string) {
    if (!await this.confirm.delete(this._i18n.translate('budget.bankAccount.messages.deleteEntryTarget'))) return;
    try {
      await lastValueFrom(this.entryGateway.delete(id));
      this.toaster.success(this._i18n.translate('budget.bankAccount.messages.entryDeleted'));
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error(this._i18n.translate('budget.bankAccount.messages.entryDeleteError'));
    }
  }

  // ── Payslip management ──

  private _pendingPayslipFile: File | null = null;

  protected uploadPayslip(file: File) {
    this._pendingPayslipFile = file;
  }

  protected async updateEntry(data: Omit<RecurringEntry, 'id'>) {
    const id = this.selectedEntry()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.entryGateway.update(id, data));
      const file = this._pendingPayslipFile;
      if (file) {
        this._pendingPayslipFile = null;
        try {
          await lastValueFrom(this.entryGateway.uploadPayslip(id, file));
          this.toaster.success(this._i18n.translate('budget.bankAccount.messages.entryUpdated'));
          this.editModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error(this._i18n.translate('budget.bankAccount.messages.payslipUploadError'));
        }
      } else {
        this.toaster.success(this._i18n.translate('budget.bankAccount.messages.entryUpdated'));
        this.editModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error(this._i18n.translate('budget.bankAccount.messages.entryUpdateError'));
    }
  }

  protected openPayslip() {
    const id = this.selectedEntry()?.id;
    if (!id) return;
    this.openPayslipById(id);
  }

  protected async openPayslipById(id: string) {
    const blob = await lastValueFrom(this.entryGateway.downloadPayslip(id));
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  protected async deletePayslip() {
    const id = this.selectedEntry()?.id;
    if (!id) return;
    if (!await this.confirm.delete(this._i18n.translate('budget.bankAccount.messages.payslipDeleteTarget'))) return;
    try {
      await lastValueFrom(this.entryGateway.deletePayslip(id));
      this.toaster.success(this._i18n.translate('budget.bankAccount.messages.payslipDeleted'));
      this._refresh.update(v => v + 1);
      const entry = this.selectedEntry();
      if (entry) {
        this.selectedEntry.set({ ...entry, payslipKey: null });
      }
    } catch {
      this.toaster.error(this._i18n.translate('budget.bankAccount.messages.payslipDeleteError'));
    }
  }
}
