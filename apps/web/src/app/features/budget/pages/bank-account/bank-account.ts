import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { lastValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import { BankAccountType } from '../../domain/models/bank-account.model';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { SalaryArchiveGateway } from '../../domain/gateways/salary-archive.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { AccountTransaction } from '../../domain/models/account-transaction.model';
import { confirmedBalance as computeConfirmedBalance } from '../../domain/account-balance';
import { buildPendingCharges } from '../../domain/pending-charges';
import { duePostings } from '../../domain/auto-post';
import { addMoney } from '../../domain/money';
import { isExpensePassed as isExpensePassedInCycle } from '../../domain/salary-cycle';
import { buildTimelineEvents } from '../../domain/timeline-builder';
import { sumAmount } from '../../domain/recurring-entry-totals';
import { computeForecastDelta } from '../../domain/forecast-delta';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { RecurringEntryForm } from '../../components/recurring-entry-form/recurring-entry-form';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { BankBalanceBand } from './bank-balance-band/bank-balance-band';
import { BudgetUsageBar } from './budget-usage-bar/budget-usage-bar';
import { BankIncomesTable } from './bank-incomes-table/bank-incomes-table';
import { BankExpenseColumns } from './bank-expense-columns/bank-expense-columns';
import { BankTransfersPanel } from './bank-transfers-panel/bank-transfers-panel';
import { BankTimeline } from './bank-timeline/bank-timeline';
import { PendingCharge } from '../../domain/pending-charge';
import { PendingChargesPanel } from './pending-charges-panel/pending-charges-panel';
import { OrphanEntriesPanel } from './orphan-entries-panel/orphan-entries-panel';
import { AccountManager } from './account-manager/account-manager';
import { BudgetDataStore } from './budget-data.store';

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

@Component({
  selector: 'app-bank-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ModalDialog,
    RecurringEntryForm,
    Icon,
    BankBalanceBand,
    BudgetUsageBar,
    BankIncomesTable,
    BankExpenseColumns,
    BankTransfersPanel,
    BankTimeline,
    TranslocoPipe,
    PendingChargesPanel,
    OrphanEntriesPanel,
    AccountManager,
  ],
  providers: [BudgetDataStore],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'budget.bankAccount.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'budget.bankAccount.subtitle' | transloco }}</p>
      </div>
      <nav
        class="flex items-center gap-2 flex-wrap"
        [attr.aria-label]="'budget.bankAccount.accountNavAria' | transloco"
      >
        @if (store.accounts().length > 1) {
          <button
            type="button"
            class="inline-flex items-center rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition-colors"
            [class.border-ib-blue]="store.selectedAccountId() === null"
            [class.bg-ib-blue]="store.selectedAccountId() === null"
            [class.text-canvas]="store.selectedAccountId() === null"
            [class.border-border]="store.selectedAccountId() !== null"
            [class.text-text-muted]="store.selectedAccountId() !== null"
            (click)="store.selectAccount(null)"
          >
            {{ 'budget.bankAccount.allAccounts' | transloco }}
          </button>
        }
        @for (da of decoratedAccounts(); track da.account.id) {
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition"
            [style.border-color]="
              store.selectedAccountId() === da.account.id ? da.color : 'var(--border)'
            "
            [style.background-color]="
              store.selectedAccountId() === da.account.id ? da.color : 'transparent'
            "
            [class.text-canvas]="store.selectedAccountId() === da.account.id"
            [class.text-text-muted]="store.selectedAccountId() !== da.account.id"
            (click)="store.selectAccount(da.account.id)"
          >
            <span
              class="inline-block h-2.5 w-2.5 rounded-full"
              [style.background-color]="da.dot"
            ></span>
            {{ da.account.name }}
          </button>
        }
        <button
          type="button"
          class="rounded-lg border border-dashed border-border min-h-8 px-3 py-1.5 text-xs text-text-muted hover:border-ib-cyan/50 hover:text-ib-cyan transition-colors"
          (click)="accountManager().open()"
        >
          <app-icon name="settings" size="12" class="inline -mt-0.5" />
          {{ 'budget.bankAccount.manage' | transloco }}
        </button>
      </nav>
    </header>

    <!-- ═══ Échéances à confirmer ═══ -->
    <app-pending-charges-panel
      [charges]="pendingCharges()"
      [accountNameById]="accountNameByIdFn"
      (confirm)="confirmCharge($event.id, $event.amount)"
      (confirmAll)="confirmAllCharges()"
      (ignore)="ignoreCharge($event)"
    />

    <app-orphan-entries-panel
      [entries]="orphanEntries()"
      [accounts]="store.accounts()"
      (reassign)="reassignEntry($event.id, $event.accountId)"
      (delete)="deleteEntry($event)"
    />

    <!-- ═══ Solde : confirmé → projeté ═══ -->
    <app-bank-balance-band
      [confirmedBalance]="confirmedBalance()"
      [projectedBalance]="projectedBalance()"
      [today]="today"
    />

    <!-- ═══ Ce qui compose le mois (décomposition + barre) ═══ -->
    <app-budget-usage-bar
      [totalIncome]="totalIncome()"
      [totalAllExpenses]="totalAllExpenses()"
      [usagePercent]="usagePercent()"
      [totalMonthlyExpenses]="totalMonthlyExpenses()"
      [monthlyAnnualExpenses]="monthlyAnnualExpenses()"
      [totalMonthSpendings]="totalMonthSpendings()"
    />

    <!-- ═══ Revenus ═══ -->
    <app-bank-incomes-table
      [incomes]="incomes()"
      [memberMap]="memberMap()"
      (create)="openCreateModal('income')"
      (edit)="openEditModal($event)"
      (delete)="deleteEntry($event)"
      (openPayslip)="openPayslipById($event)"
    />

    <!-- ═══ 3 colonnes : Prélèvements / Annuels / Dépenses ═══ -->
    <app-bank-expense-columns
      [monthlyExpenses]="monthlyOutflowRows()"
      [savingsSubtotal]="savingsTransfersTotal()"
      [accountNameById]="accountNameByIdFn"
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
      (nextMonth)="nextMonth()"
    />

    <!-- ═══ Virements ═══ -->
    <app-bank-transfers-panel
      [recurringTransfers]="incomingTransfers()"
      [monthOneTimeTransfers]="monthOneTimeTransfers()"
      [totalOneTimeOutgoing]="totalOneTimeOutgoing()"
      [totalOneTimeIncoming]="totalOneTimeIncoming()"
      [selectedAccountId]="store.selectedAccountId()"
      [memberMap]="memberMap()"
      [accountNameById]="accountNameByIdFn"
      [isExpensePassed]="isExpensePassedFn"
      [spendingMonthLabel]="spendingMonthLabel()"
      [accountsCount]="store.accounts().length"
      (createOneTime)="openCreateModal('transfer', 'one_time')"
      (edit)="openEditModal($event)"
      (delete)="deleteEntry($event)"
      (prevMonth)="prevMonth()"
      (nextMonth)="nextMonth()"
    />

    <!-- ═══ Timeline du mois ═══ -->
    <app-bank-timeline
      [timelineEvents]="timelineEvents()"
      [currentDay]="currentDay"
      [currentBalance]="confirmedBalance()"
    />

    <!-- ═══ Modals ═══ -->
    <app-account-manager
      [decoratedAccounts]="decoratedAccounts()"
      [entries]="store.entries()"
      [(selectedAccountId)]="store.selectedAccountId"
      (accountsChanged)="store.refreshAccounts()"
      (entriesChanged)="store.refreshEntries()"
    />

    <app-modal-dialog #createModal [title]="createModalTitle()" (closed)="onModalClosed()">
      @if (createModal.isOpen()) {
        <app-recurring-entry-form
          [forcedType]="createType()"
          [forcedAccountId]="store.selectedAccountId()"
          [initialTransferMode]="createTransferMode()"
          [accounts]="store.accounts()"
          [members]="store.members()"
          (submitted)="createEntry($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal [title]="editModalTitle()" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-recurring-entry-form
          [initial]="selectedEntry()"
          [accounts]="store.accounts()"
          [members]="store.members()"
          (submitted)="updateEntry($event)"
          (fileAttached)="uploadPayslip($event)"
          (viewPayslip)="openPayslip()"
          (removePayslip)="deletePayslip()"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>
  `,
})
export class BankAccount {
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly archiveGateway = inject(SalaryArchiveGateway);
  private readonly txGateway = inject(AccountTransactionGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);
  private readonly _destroyRef = inject(DestroyRef);
  protected readonly store = inject(BudgetDataStore);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  protected readonly accountManager = viewChild.required(AccountManager);

  private readonly todayIso = new Date().toISOString().slice(0, 10);

  private readonly _autoPostAttempted = signal(false);

  constructor() {
    effect(() => {
      if (
        !this.store.entriesLoaded() ||
        !this.store.transactionsLoaded() ||
        this._autoPostAttempted()
      )
        return;
      this._autoPostAttempted.set(true);
      const entries = untracked(this.store.entries);
      const txs = untracked(this.store.transactions);
      untracked(() => this._runAutoPost(entries, txs));
    });
  }

  protected readonly filteredEntries = computed(() => {
    const accountId = this.store.selectedAccountId();
    const all = this.store.entries();
    if (accountId === null) return all;
    return all.filter((e) => e.accountId === accountId);
  });

  private readonly currentMonth = new Date().toISOString().slice(0, 7);

  private isActive(entry: RecurringEntry): boolean {
    if (!entry.endDate) return true;
    return entry.endDate.slice(0, 7) >= this.currentMonth;
  }

  protected readonly incomes = computed(() =>
    this.filteredEntries().filter((e) => e.type === 'income' && this.isActive(e)),
  );
  protected readonly monthlyExpenses = computed(() =>
    this.filteredEntries().filter((e) => e.type === 'expense' && this.isActive(e)),
  );
  protected readonly annualExpenses = computed(() =>
    this.filteredEntries().filter((e) => e.type === 'annual_expense' && this.isActive(e)),
  );
  protected readonly allSpendings = computed(() =>
    this.filteredEntries().filter((e) => e.type === 'spending'),
  );

  protected readonly transfers = computed(() => {
    const accountId = this.store.selectedAccountId();
    const all = this.store.entries().filter((e) => e.type === 'transfer' && this.isActive(e));
    if (accountId === null) return all;
    return all.filter((e) => e.accountId === accountId || e.toAccountId === accountId);
  });

  protected readonly recurringTransfers = computed(() =>
    this.transfers().filter((e) => e.dayOfMonth != null),
  );

  protected readonly oneTimeTransfers = computed(() =>
    this.transfers().filter((e) => !e.dayOfMonth && !!e.date),
  );

  protected readonly monthOneTimeTransfers = computed(() => {
    const ym = this.spendingMonth();
    return this.oneTimeTransfers()
      .filter((e) => e.date!.startsWith(ym))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  private readonly outgoingTransfers = computed(() => {
    const accountId = this.store.selectedAccountId();
    return this.recurringTransfers().filter((e) => e.accountId === accountId);
  });

  protected readonly incomingTransfers = computed(() => {
    const accountId = this.store.selectedAccountId();
    return this.recurringTransfers().filter((e) => e.toAccountId === accountId);
  });

  private readonly accountTypeById = computed(() => {
    const map = new Map<string, BankAccountType>();
    for (const a of this.store.accounts()) map.set(a.id, a.type);
    return map;
  });

  // Lignes affichées dans la colonne Prélèvements : dépenses mensuelles + virements
  // récurrents sortants, triées par jour. Les totaux de dépenses NE changent pas.
  protected readonly monthlyOutflowRows = computed(() =>
    [...this.monthlyExpenses(), ...this.outgoingTransfers()].sort(
      (a, b) => (a.dayOfMonth ?? 32) - (b.dayOfMonth ?? 32),
    ),
  );

  // Sous-total « dont épargne » : virements récurrents sortants vers un compte type='épargne'.
  protected readonly savingsTransfersTotal = computed(() => {
    const types = this.accountTypeById();
    return sumAmount(
      this.outgoingTransfers().filter((e) => types.get(e.toAccountId ?? '') === 'épargne'),
    );
  });

  protected readonly spendingMonth = signal(new Date().toISOString().slice(0, 7));

  private readonly _i18nReady = toSignal(this._i18n.events$, { initialValue: null });

  protected readonly spendingMonthLabel = computed(() => {
    this._i18nReady();
    const [y, m] = this.spendingMonth().split('-');
    const monthKeys = [
      'janv',
      'fevr',
      'mars',
      'avril',
      'mai',
      'juin',
      'juil',
      'aout',
      'sept',
      'oct',
      'nov',
      'dec',
    ];
    const monthLabel = this._i18n.translate(`budget.common.month.${monthKeys[Number(m) - 1]}`);
    return `${monthLabel} ${y}`;
  });

  protected readonly monthSpendingsLabel = computed(() => {
    const count = this.monthSpendings().length;
    const key =
      count > 1
        ? 'budget.bankAccount.kpi.spendingCountPlural'
        : 'budget.bankAccount.kpi.spendingCount';
    return this._i18n.translate(key, { count, month: this.spendingMonthLabel() });
  });

  protected readonly monthSpendings = computed(() => {
    const ym = this.spendingMonth();
    return this.allSpendings()
      .filter((e) => {
        if (!e.date) return true;
        return e.date.startsWith(ym);
      })
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  protected readonly today = new Date().toLocaleDateString(
    this._i18n.getActiveLang() === 'en' ? 'en-US' : 'fr-FR',
    { day: 'numeric', month: 'short' },
  );
  protected readonly currentDay = new Date().getDate();

  protected readonly salaryDay = computed(() => {
    const firstIncome = this.incomes().find((e) => e.dayOfMonth);
    return firstIncome?.dayOfMonth ?? 1;
  });

  protected isExpensePassed(entry: RecurringEntry): boolean {
    return isExpensePassedInCycle(entry, this.salaryDay(), this.currentDay);
  }

  // Bound function references for child components (kept stable)
  protected readonly isExpensePassedFn = (entry: RecurringEntry) => this.isExpensePassed(entry);
  protected readonly accountNameByIdFn = (id: string | null) => this.accountNameById(id);

  protected readonly selectedAccount = computed(() => {
    const id = this.store.selectedAccountId();
    return this.store.accounts().find((a) => a.id === id) ?? null;
  });

  protected readonly selectedInitialBalance = computed(() =>
    Number(this.selectedAccount()?.initialBalance ?? 0),
  );

  protected readonly accountRealTxs = computed(() => {
    const id = this.store.selectedAccountId();
    const txs = this.store.transactions();
    if (id === null) return txs;
    return txs.filter((t) => t.accountId === id || t.toAccountId === id);
  });

  protected readonly confirmedBalance = computed(() => {
    const acc = this.selectedAccount();
    if (acc) return computeConfirmedBalance(acc, this.accountRealTxs(), this.todayIso);
    const txs = this.store.transactions();
    return this.store.accounts().reduce(
      (sum, a) =>
        addMoney(
          sum,
          computeConfirmedBalance(
            a,
            txs.filter((t) => t.accountId === a.id || t.toAccountId === a.id),
            this.todayIso,
          ),
        ),
      0,
    );
  });

  // Delta des récurrences = formule de endOfMonthBalance SANS le solde initial,
  // chaque somme excluant les récurrences déjà postées (réconciliées avec une transaction réelle).
  protected readonly forecastDelta = computed(() =>
    computeForecastDelta({
      incomes: this.incomes(),
      monthlyExpenses: this.monthlyExpenses(),
      annualExpenses: this.annualExpenses(),
      monthSpendings: this.monthSpendings(),
      incomingTransfers: this.incomingTransfers(),
      outgoingTransfers: this.outgoingTransfers(),
      oneTimeIncoming: this.totalOneTimeIncoming(),
      oneTimeOutgoing: this.totalOneTimeOutgoing(),
      txs: this.accountRealTxs(),
      currentMonth: this.currentMonth,
    }),
  );

  protected readonly projectedBalance = computed(
    () => this.confirmedBalance() + this.forecastDelta(),
  );

  private readonly _ignoredCharges = signal<ReadonlySet<string>>(new Set());

  protected readonly orphanEntries = computed(() =>
    this.store.entries().filter((e) => e.accountId == null),
  );

  // Un virement n'est une échéance « à débiter » que pour son compte SOURCE (le débité).
  // Sur le compte destinataire, le crédit est matérialisé par la MÊME transaction quand la
  // source la poste : l'afficher comme un prélèvement à débiter induirait en erreur (on
  // confirmerait un « prélèvement » qui en réalité ajoute au solde). Vue « Tous les comptes »
  // (sel = null) : on garde tous les virements (présentés du point de vue de leur source).
  private readonly pendingTransferCharges = computed(() => {
    const sel = this.store.selectedAccountId();
    return this.recurringTransfers().filter((e) => sel === null || e.accountId === sel);
  });

  protected readonly pendingCharges = computed<PendingCharge[]>(() =>
    buildPendingCharges({
      incomes: this.incomes(),
      monthlyExpenses: this.monthlyExpenses(),
      recurringTransfers: this.pendingTransferCharges(),
      ignored: this._ignoredCharges(),
      salaryDay: this.salaryDay(),
      currentDay: this.currentDay,
      currentMonth: this.currentMonth,
      txs: this.accountRealTxs(),
    }),
  );

  protected reassignEntry(id: string, accountId: string): void {
    const entry = this.store.entries().find((e) => e.id === id);
    if (!entry) return;
    const { id: _id, ...rest } = entry;
    this.entryGateway
      .update(id, { ...rest, accountId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.store.refreshEntries();
          this.toaster.success('budget.bankAccount.messages.entryReassigned');
        },
        error: () => this.toaster.error('budget.bankAccount.messages.entryReassignError'),
      });
  }

  // Construit le payload de transaction réelle dérivé d'une récurrence : les champs liés à
  // l'entrée (compte, virement, catégorie, membre, lien recurringEntryId) sont toujours repris ;
  // montant / sens / date / note varient selon le contexte (confirmation manuelle, auto-post…).
  private _txPayloadFor(
    entry: RecurringEntry,
    over: Pick<AccountTransaction, 'amount' | 'direction' | 'date' | 'note'>,
  ): Omit<AccountTransaction, 'id' | 'accountId'> {
    return {
      ...over,
      toAccountId: entry.toAccountId,
      category: entry.category,
      memberId: entry.memberId,
      recurringEntryId: entry.id,
    };
  }

  protected confirmCharge(id: string, amount: number): void {
    const charge = this.pendingCharges().find((c) => c.entry.id === id);
    if (!charge) return;
    const e = charge.entry;
    this.txGateway
      .create(
        e.accountId!,
        this._txPayloadFor(e, {
          amount,
          direction: charge.direction,
          date: charge.suggestedDate,
          note: null,
        }),
      )
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.store.refreshTransactions();
          this.toaster.success('budget.bankAccount.messages.chargeConfirmed');
        },
        error: () => this.toaster.error('budget.bankAccount.messages.chargeConfirmError'),
      });
  }

  protected confirmAllCharges(): void {
    const charges = this.pendingCharges();
    if (charges.length === 0) return;
    let settled = 0;
    let failed = 0;
    const done = () => {
      if (++settled < charges.length) return;
      this.store.refreshTransactions();
      if (failed > 0)
        this.toaster.error('budget.bankAccount.messages.chargesConfirmError', { failed });
      else
        this.toaster.success('budget.bankAccount.messages.chargesConfirmed', {
          count: charges.length,
        });
    };
    for (const c of charges) {
      const e = c.entry;
      this.txGateway
        .create(
          e.accountId!,
          this._txPayloadFor(e, {
            amount: c.suggestedAmount,
            direction: c.direction,
            date: c.suggestedDate,
            note: null,
          }),
        )
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe({
          next: done,
          error: () => {
            failed++;
            done();
          },
        });
    }
  }

  protected ignoreCharge(id: string): void {
    this._ignoredCharges.update((s) => new Set(s).add(id));
  }

  private _runAutoPost(
    entries: readonly RecurringEntry[],
    txs: readonly AccountTransaction[],
  ): void {
    const due = duePostings(entries, txs, {
      currentMonth: this.currentMonth,
      currentDay: this.currentDay,
    });
    if (due.length === 0) return;

    const monthsCount = new Set(due.map((d) => d.month)).size;
    let settled = 0;
    let failed = 0;
    const done = () => {
      if (++settled < due.length) return;
      this.store.refreshTransactions();
      if (failed > 0) this.toaster.error('budget.bankAccount.messages.autoPostError', { failed });
      else if (monthsCount > 1)
        this.toaster.success('budget.bankAccount.messages.autoPostCaughtUp', {
          count: due.length,
          months: monthsCount,
        });
      else this.toaster.success('budget.bankAccount.messages.autoPosted', { count: due.length });
    };

    for (const d of due) {
      const e = d.entry;
      this.txGateway
        .create(
          e.accountId!,
          this._txPayloadFor(e, {
            amount: d.amount,
            direction: d.direction,
            date: d.date,
            note: 'auto',
          }),
        )
        .pipe(takeUntilDestroyed(this._destroyRef))
        .subscribe({
          next: done,
          error: () => {
            failed++;
            done();
          },
        });
    }
  }

  protected readonly totalIncome = computed(() => sumAmount(this.incomes()));
  protected readonly totalMonthlyExpenses = computed(() => sumAmount(this.monthlyExpenses()));
  protected readonly totalAnnualExpenses = computed(() => sumAmount(this.annualExpenses()));
  protected readonly monthlyAnnualExpenses = computed(() => this.totalAnnualExpenses() / 12);
  protected readonly totalMonthSpendings = computed(() => sumAmount(this.monthSpendings()));

  // Virements ponctuels sortants/entrants du mois encore en projection : ceux déjà matérialisés
  // en transaction réelle (recurringEntryId) sont comptés dans le solde confirmé → exclus ici
  // pour éviter le double comptage.
  private readonly _unpostedOneTime = (predicate: (e: RecurringEntry) => boolean) => {
    const txs = this.store.transactions();
    return this.monthOneTimeTransfers().filter(
      (e) => predicate(e) && !txs.some((t) => t.recurringEntryId === e.id),
    );
  };
  protected readonly totalOneTimeOutgoing = computed(() =>
    sumAmount(this._unpostedOneTime((e) => e.accountId === this.store.selectedAccountId())),
  );
  protected readonly totalOneTimeIncoming = computed(() =>
    sumAmount(this._unpostedOneTime((e) => e.toAccountId === this.store.selectedAccountId())),
  );

  private readonly totalOutgoing = computed(
    () => sumAmount(this.outgoingTransfers()) + this.totalOneTimeOutgoing(),
  );
  private readonly totalIncoming = computed(
    () => sumAmount(this.incomingTransfers()) + this.totalOneTimeIncoming(),
  );

  protected readonly totalAllExpenses = computed(
    () =>
      this.totalMonthlyExpenses() +
      this.monthlyAnnualExpenses() +
      this.totalMonthSpendings() +
      this.totalOutgoing(),
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
  protected readonly timelineEvents = computed(() =>
    buildTimelineEvents({
      incomes: this.incomes(),
      monthlyExpenses: this.monthlyExpenses(),
      outgoingTransfers: this.outgoingTransfers(),
      incomingTransfers: this.incomingTransfers(),
      salaryDay: this.salaryDay(),
      currentDay: this.currentDay,
      accountName: (id) => this.accountNameById(id),
      fallbackLabel: this._i18n.translate('budget.bankAccount.timelineFallback'),
    }),
  );

  protected readonly createModalTitle = computed(() => {
    switch (this.createType()) {
      case 'income':
        return this._i18n.translate('budget.bankAccount.createTitles.income');
      case 'expense':
        return this._i18n.translate('budget.bankAccount.createTitles.expense');
      case 'annual_expense':
        return this._i18n.translate('budget.bankAccount.createTitles.annualExpense');
      case 'spending':
        return this._i18n.translate('budget.bankAccount.createTitles.spending');
      case 'transfer':
        return this._i18n.translate(
          this.createTransferMode() === 'one_time'
            ? 'budget.bankAccount.createTitles.transferOneTime'
            : 'budget.bankAccount.createTitles.transferRecurring',
        );
    }
  });
  protected readonly editModalTitle = computed(() => {
    switch (this.selectedEntry()?.type) {
      case 'income':
        return this._i18n.translate('budget.bankAccount.editTitles.income');
      case 'expense':
        return this._i18n.translate('budget.bankAccount.editTitles.expense');
      case 'annual_expense':
        return this._i18n.translate('budget.bankAccount.editTitles.annualExpense');
      case 'spending':
        return this._i18n.translate('budget.bankAccount.editTitles.spending');
      case 'transfer':
        return this._i18n.translate('budget.bankAccount.editTitles.transfer');
      default:
        return this._i18n.translate('budget.bankAccount.editTitles.default');
    }
  });

  protected readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string }>();
    const members = this.store.members();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      map.set(m.id, {
        name: `${m.firstName} ${m.lastName}`,
        color: PALETTE[(i + 3) % PALETTE.length],
      });
    }
    return map;
  });

  protected readonly decoratedAccounts = computed(() =>
    this.store.accounts().map((account, i) => ({
      account,
      color: PALETTE[i % PALETTE.length],
      dot: PALETTE[(i + 3) % PALETTE.length],
    })),
  );

  private readonly accountMap = computed(() => {
    const map = new Map<string, string>();
    for (const a of this.store.accounts()) {
      map.set(a.id, a.name);
    }
    return map;
  });

  protected accountNameById(id: string | null): string | null {
    if (!id) return null;
    return this.accountMap().get(id) ?? null;
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

  protected openCreateModal(
    type: RecurringEntryType,
    transferMode: 'recurring' | 'one_time' = 'recurring',
  ) {
    this.createType.set(type);
    this.createTransferMode.set(transferMode);
    this.createModalRef().open();
  }

  protected openEditModal(entry: RecurringEntry) {
    this.selectedEntry.set(entry);
    this.editModalRef().open();
  }

  protected onModalClosed() {
    this.selectedEntry.set(null);
  }

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
          this.toaster.success('budget.bankAccount.messages.cycleArchived');
        }
      }

      const created = await lastValueFrom(this.entryGateway.create(data));
      await this._postIfImmediateOneTimeTransfer(created);
      this.toaster.success('budget.bankAccount.messages.entryCreated');
      this.createModalRef().close();
      this.store.refreshEntries();
    } catch {
      this.toaster.error('budget.bankAccount.messages.entryCreateError');
    }
  }

  // Un virement ponctuel (type transfer, sans dayOfMonth) représente un mouvement qui a déjà eu
  // lieu : on matérialise immédiatement la transaction réelle pour qu'elle impacte le solde confirmé,
  // au lieu de rester une simple projection. Liée par recurringEntryId → exclue du delta projeté
  // (cf. totalOneTimeIncoming/Outgoing) pour éviter le double comptage. Skip si daté dans le futur
  // (encore une projection) ou sans compte source (orphelin → la table transactions exige un compte).
  private async _postIfImmediateOneTimeTransfer(entry: RecurringEntry): Promise<void> {
    const isOneTimeTransfer = entry.type === 'transfer' && entry.dayOfMonth == null && !!entry.date;
    if (!isOneTimeTransfer || entry.accountId == null || entry.date! > this.todayIso) return;
    await lastValueFrom(
      this.txGateway.create(
        entry.accountId,
        this._txPayloadFor(entry, {
          amount: entry.amount,
          direction: 'transfer',
          date: entry.date!,
          note: null,
        }),
      ),
    );
    this.store.refreshTransactions();
  }

  private async archiveCurrentCycle() {
    const salary = this.totalIncome();
    if (salary <= 0) return;

    const month = new Date().toISOString().slice(0, 7);
    const accountId = this.store.selectedAccountId();
    const totalExpenses = this.totalMonthlyExpenses() + this.monthlyAnnualExpenses();
    const totalSpendings = this.totalMonthSpendings();
    const spendings = this.monthSpendings().map((e) => ({
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
    if (
      !(await this.confirm.delete(
        this._i18n.translate('budget.bankAccount.messages.deleteEntryTarget'),
      ))
    )
      return;
    try {
      await lastValueFrom(this.entryGateway.delete(id));
      this.toaster.success('budget.bankAccount.messages.entryDeleted');
      this.store.refreshEntries();
    } catch {
      this.toaster.error('budget.bankAccount.messages.entryDeleteError');
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
          this.toaster.success('budget.bankAccount.messages.entryUpdated');
          this.editModalRef().close();
          this.store.refreshEntries();
        } catch {
          this.toaster.error('budget.bankAccount.messages.payslipUploadError');
        }
      } else {
        this.toaster.success('budget.bankAccount.messages.entryUpdated');
        this.editModalRef().close();
        this.store.refreshEntries();
      }
    } catch {
      this.toaster.error('budget.bankAccount.messages.entryUpdateError');
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
    if (
      !(await this.confirm.delete(
        this._i18n.translate('budget.bankAccount.messages.payslipDeleteTarget'),
      ))
    )
      return;
    try {
      await lastValueFrom(this.entryGateway.deletePayslip(id));
      this.toaster.success('budget.bankAccount.messages.payslipDeleted');
      this.store.refreshEntries();
      const entry = this.selectedEntry();
      if (entry) {
        this.selectedEntry.set({ ...entry, payslipKey: null });
      }
    } catch {
      this.toaster.error('budget.bankAccount.messages.payslipDeleteError');
    }
  }
}
