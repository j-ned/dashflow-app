import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { lastValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import {
  BankAccount as BankAccountModel,
  BankAccountType,
} from '../../domain/models/bank-account.model';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { isBalanceCheckDue, reconcileBalance } from '../../domain/balance-check';
import { BalanceCheckStore } from '../../infra/balance-check.store';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { AccountTransaction } from '../../domain/models/account-transaction.model';
import { buildPendingCharges } from '../../domain/pending-charges';
import {
  AUTO_POST_NOTE,
  autoPostCandidates,
  duePostings,
  withAutoPost,
} from '../../domain/auto-post';
import { toLocalIsoDate } from '../../domain/local-date';
import { immediatePostingFor } from '../../domain/immediate-posting';
import { isExpensePassed as isExpensePassedInCycle } from '../../domain/salary-cycle';
import { buildTimelineEvents } from '../../domain/timeline-builder';
import { sumAmount } from '../../domain/recurring-entry-totals';
import { computeForecast } from '../../domain/forecast-delta';
import { monthIncome } from '../../domain/month-income';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { openBlobInNewTab } from '@shared/browser/open-blob-in-new-tab';
import { RecurringEntryForm } from '../../components/recurring-entry-form/recurring-entry-form';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { uploadErrorKey } from '@shared/forms/upload-file-policy';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { BankBalanceBand } from './bank-balance-band/bank-balance-band';
import { BalanceCheck } from './balance-check/balance-check';
import { BudgetUsageBar } from './budget-usage-bar/budget-usage-bar';
import { BankIncomesTable } from './bank-incomes-table/bank-incomes-table';
import { BankExpenseColumns } from './bank-expense-columns/bank-expense-columns';
import { BankTransfersPanel } from './bank-transfers-panel/bank-transfers-panel';
import { BankTimeline } from './bank-timeline/bank-timeline';
import { PendingCharge, isIncomeCharge } from '../../domain/pending-charge';
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
    BalanceCheck,
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
        class="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0"
        #accountNav
        [attr.aria-label]="'budget.bankAccount.accountNavAria' | transloco"
      >
        @if (store.accounts().length > 1) {
          <button
            type="button"
            class="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition-colors"
            [class.border-ib-blue]="store.selectedAccountId() === null"
            [class.bg-ib-blue]="store.selectedAccountId() === null"
            [class.text-canvas]="store.selectedAccountId() === null"
            [class.border-border]="store.selectedAccountId() !== null"
            [class.text-text-muted]="store.selectedAccountId() !== null"
            [attr.aria-pressed]="store.selectedAccountId() === null"
            (click)="store.selectAccount(null)"
          >
            {{ 'budget.bankAccount.allAccounts' | transloco }}
          </button>
        }
        @for (da of decoratedAccounts(); track da.account.id) {
          <button
            type="button"
            class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition"
            [style.border-color]="
              store.selectedAccountId() === da.account.id ? da.color : 'var(--border)'
            "
            [style.background-color]="
              store.selectedAccountId() === da.account.id ? da.color : 'transparent'
            "
            [class.text-canvas]="store.selectedAccountId() === da.account.id"
            [class.text-text-muted]="store.selectedAccountId() !== da.account.id"
            [attr.aria-pressed]="store.selectedAccountId() === da.account.id"
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
          class="shrink-0 whitespace-nowrap rounded-lg border border-dashed border-border min-h-8 px-3 py-1.5 text-xs text-text-muted hover:border-ib-cyan/50 hover:text-ib-cyan transition-colors"
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
      [automatableCount]="automatable().length"
      (confirmAll)="confirmAllCharges()"
      (automateAll)="automateAllCharges()"
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
      [upcomingDebits]="forecast().upcomingDebits"
      [unknownIncomes]="unknownIncomeLabels()"
      [needsStartingBalance]="needsStartingBalance()"
      [today]="today"
    >
      @if (selectedAccount(); as account) {
        <app-balance-check
          [confirmedBalance]="confirmedBalance()"
          [checkedAt]="balanceCheckedAt()"
          [due]="balanceCheckDue()"
          [busy]="reconciling()"
          (checked)="reconcileWithBank(account, $event)"
        />
      }
    </app-bank-balance-band>

    <!-- ═══ Ce qui compose le mois (décomposition + barre) ═══ -->
    <app-budget-usage-bar
      [totalIncome]="totalIncome()"
      [incomeIncomplete]="incomeIncomplete()"
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
  private readonly txGateway = inject(AccountTransactionGateway);
  private readonly accountGateway = inject(BankAccountGateway);
  private readonly balanceChecks = inject(BalanceCheckStore);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);
  private readonly _destroyRef = inject(DestroyRef);
  protected readonly store = inject(BudgetDataStore);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  protected readonly accountManager = viewChild.required(AccountManager);
  private readonly accountNav = viewChild<ElementRef<HTMLElement>>('accountNav');

  private readonly todayIso = toLocalIsoDate(new Date());

  private readonly _autoPostAttempted = signal(false);

  constructor() {
    // Téléphone : les pastilles défilent sur une ligne ; le compte sélectionné doit rester visible.
    afterRenderEffect({
      write: () => {
        this.store.selectedAccountId();
        this.decoratedAccounts();
        this.accountNav()
          ?.nativeElement.querySelector('[aria-pressed="true"]')
          ?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
      },
    });
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

  private readonly currentMonth = toLocalIsoDate(new Date()).slice(0, 7);

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

  // Cluster solde déplacé dans BudgetDataStore (réutilisable) ; ré-exposé ici pour le template.
  protected readonly selectedAccount = this.store.selectedAccount;
  protected readonly selectedInitialBalance = this.store.selectedInitialBalance;
  protected readonly accountRealTxs = this.store.accountRealTxs;
  protected readonly confirmedBalance = this.store.confirmedBalance;

  // Delta des récurrences = formule de endOfMonthBalance SANS le solde initial,
  // chaque somme excluant les récurrences déjà postées (réconciliées avec une transaction réelle).
  protected readonly forecast = computed(() =>
    computeForecast({
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
    () => this.confirmedBalance() + this.forecast().delta,
  );

  /** Revenus à montant variable pas encore saisis : tant qu'il y en a, la projection est incomplète. */
  protected readonly unknownIncomeLabels = computed(() =>
    this.forecast().unknownIncomes.map((e) => e.label),
  );

  // Aucun point de départ : solde initial à 0 et aucune opération réelle → « confirmé 0,00 € » ne
  // veut rien dire, on invite à renseigner le solde réel plutôt que d'afficher un zéro trompeur.
  protected readonly needsStartingBalance = computed(
    () =>
      this.selectedAccount() != null &&
      this.selectedInitialBalance() === 0 &&
      this.accountRealTxs().length === 0,
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
  // montant / sens / date / note varient selon le contexte (confirmation manuelle, auto-post, etc.).
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
    // Jamais un revenu en lot : un salaire se saisit, il ne se confirme pas à l'aveugle.
    const charges = this.pendingCharges().filter(
      (c): c is PendingCharge & { suggestedAmount: number } =>
        !isIncomeCharge(c) && c.suggestedAmount !== null,
    );
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

  // Prélèvements fixes encore confirmés à la main sur le compte affiché.
  protected readonly automatable = computed(() => autoPostCandidates(this.monthlyExpenses()));

  /**
   * Bascule tous les prélèvements fixes en pointage automatique. Ceux déjà échus ce mois-ci sont
   * matérialisés dans la foulée par l'effet d'auto-pointage (équivaut à « Tout confirmer »), les
   * suivants le seront à leur date, sans intervention.
   */
  protected async automateAllCharges(): Promise<void> {
    const targets = this.automatable();
    if (targets.length === 0) return;
    const confirmed = await this.confirm.confirm({
      title: this._i18n.translate('budget.bankAccount.pending.automateTitle'),
      message: this._i18n.translate('budget.bankAccount.pending.automateMessage', {
        count: targets.length,
        labels: targets.map((e) => e.label).join(', '),
      }),
      confirmLabel: this._i18n.translate('budget.bankAccount.pending.automateConfirm'),
      variant: 'info',
    });
    if (!confirmed) return;

    let failed = 0;
    const automated: RecurringEntry[] = [];
    for (const entry of targets) {
      const payload = withAutoPost(entry, this.currentMonth);
      try {
        await lastValueFrom(this.entryGateway.update(entry.id, payload));
        automated.push({ id: entry.id, ...payload });
      } catch {
        failed++;
      }
    }
    this.store.refreshEntries();
    // L'auto-pointage ne tourne qu'à l'ouverture de la page : on le relance ici sur ce qu'on vient
    // d'automatiser, sinon les échéances déjà passées ce mois-ci attendraient la prochaine visite.
    this._runAutoPost(automated, this.store.transactions());
    if (failed > 0) this.toaster.error('budget.bankAccount.pending.automateError', { failed });
    else this.toaster.success('budget.bankAccount.pending.automated', { count: targets.length });
  }

  // ── Vérification du solde avec la banque ──
  protected readonly reconciling = signal(false);
  protected readonly balanceCheckedAt = computed(() => {
    const account = this.selectedAccount();
    return account ? this.balanceChecks.checkedAt(account.id) : null;
  });
  protected readonly balanceCheckDue = computed(() =>
    isBalanceCheckDue(this.balanceCheckedAt(), Date.now()),
  );

  /**
   * L'utilisateur a saisi le solde affiché par sa banque. Écart nul : on note simplement la
   * vérification. Compte sans opération : l'écart devient le solde de départ. Sinon : une opération
   * d'ajustement datée d'aujourd'hui, visible dans le relevé.
   */
  protected async reconcileWithBank(account: BankAccountModel, realBalance: number): Promise<void> {
    const outcome = reconcileBalance({
      confirmedBalance: this.confirmedBalance(),
      realBalance,
      initialBalance: account.initialBalance,
      hasTransactions: this.accountRealTxs().length > 0,
      today: this.todayIso,
    });
    this.reconciling.set(true);
    try {
      if (outcome.kind === 'starting-balance') {
        // En E2EE, l'update remplace tout le blob chiffré → on renvoie le compte complet.
        await lastValueFrom(
          this.accountGateway.update(account.id, {
            name: account.name,
            type: account.type,
            color: account.color,
            dotColor: account.dotColor,
            initialBalance: outcome.initialBalance,
          }),
        );
        this.store.refreshAccounts();
      } else if (outcome.kind === 'adjustment') {
        await lastValueFrom(
          this.txGateway.create(account.id, {
            ...outcome.transaction,
            toAccountId: null,
            category: null,
            memberId: null,
            recurringEntryId: null,
            note: this._i18n.translate('budget.bankAccount.check.adjustmentNote'),
          }),
        );
        this.store.refreshTransactions();
      }
      this.balanceChecks.markChecked(account.id);
      this.toaster.success(
        outcome.kind === 'none'
          ? 'budget.bankAccount.check.toastMatch'
          : 'budget.bankAccount.check.toastAdjusted',
      );
    } catch {
      this.toaster.error('budget.bankAccount.check.toastError');
    } finally {
      this.reconciling.set(false);
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
            note: AUTO_POST_NOTE,
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

  // Revenus du mois : le réel s'il a été saisi, le prévu sinon ; un revenu variable non saisi ne
  // compte pas (voir monthIncome).
  private readonly _monthIncome = computed(() =>
    monthIncome(this.incomes(), this.accountRealTxs(), this.currentMonth),
  );
  protected readonly totalIncome = computed(() => this._monthIncome().total);
  protected readonly incomeIncomplete = computed(() => this._monthIncome().incomplete);
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
      const created = await lastValueFrom(this.entryGateway.create(data));
      await this._postIfDue(created);
      this.toaster.success('budget.bankAccount.messages.entryCreated');
      this.createModalRef().close();
      this.store.refreshEntries();
    } catch {
      this.toaster.error('budget.bankAccount.messages.entryCreateError');
    }
  }

  // Toute échéance créée (income, expense, transfer) est postée immédiatement en transaction réelle
  // si son échéance est déjà due (date ≤ aujourd'hui pour les ponctuels, dayOfMonth ≤ currentDay
  // pour les récurrents). Cela permet d'impacter le solde confirmé dès la création, sans attendre
  // le cycle d'auto-post. Liée par recurringEntryId → exclue du delta projeté pour éviter le
  // double comptage. Skip si non postable (accountId null, type non éligible, date future).
  private async _postIfDue(created: RecurringEntry): Promise<void> {
    const posting = immediatePostingFor(created, {
      today: this.todayIso,
      currentMonth: this.currentMonth,
      currentDay: this.currentDay,
    });
    if (posting == null) return;
    await lastValueFrom(
      this.txGateway.create(
        created.accountId!,
        this._txPayloadFor(created, {
          amount: posting.amount,
          direction: posting.direction,
          date: posting.date,
          note: null,
        }),
      ),
    );
    this.store.refreshTransactions();
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
        } catch (e) {
          this.toaster.error(uploadErrorKey(e) ?? 'budget.bankAccount.messages.payslipUploadError');
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
    openBlobInNewTab(blob);
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
