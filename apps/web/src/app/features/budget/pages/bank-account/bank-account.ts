import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { RecurringEntry, RecurringEntryType } from '../../domain/models/recurring-entry.model';
import { BankAccount as BankAccountModel } from '../../domain/models/bank-account.model';
import { GetRecurringEntriesUseCase } from '../../domain/use-cases/get-recurring-entries.use-case';
import { CreateRecurringEntryUseCase } from '../../domain/use-cases/create-recurring-entry.use-case';
import { UpdateRecurringEntryUseCase } from '../../domain/use-cases/update-recurring-entry.use-case';
import { DeleteRecurringEntryUseCase } from '../../domain/use-cases/delete-recurring-entry.use-case';
import { GetBankAccountsUseCase } from '../../domain/use-cases/get-bank-accounts.use-case';
import { CreateBankAccountUseCase } from '../../domain/use-cases/create-bank-account.use-case';
import { DeleteBankAccountUseCase } from '../../domain/use-cases/delete-bank-account.use-case';
import { UpdateBankAccountUseCase } from '../../domain/use-cases/update-bank-account.use-case';
import { GetMembersUseCase } from '../../domain/use-cases/get-members.use-case';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { RecurringEntryForm } from '../../components/recurring-entry-form/recurring-entry-form';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { CreateSalaryArchiveUseCase } from '../../domain/use-cases/create-salary-archive.use-case';
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

@Component({
  selector: 'app-bank-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ModalDialog, RecurringEntryForm, Icon, BankKpiGrid, BudgetUsageBar, BankIncomesTable, BankExpenseColumns, BankTransfersPanel, BankTimeline],
  host: { class: 'block space-y-6' },
  template: `
    <!-- Header + compte selector -->
    <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Compte bancaire</h2>
        <p class="mt-1 text-sm text-text-muted">Suivi progressif de votre solde</p>
      </div>
      <nav class="flex items-center gap-2 flex-wrap">
        @for (account of accounts(); track account.id; let i = $index) {
          <button type="button"
                  class="inline-flex items-center gap-2 rounded-lg border min-h-8 px-3 py-1.5 text-xs font-medium transition"
                  [style.border-color]="selectedAccountId() === account.id ? accountColor(i) : 'var(--border)'"
                  [style.background-color]="selectedAccountId() === account.id ? accountColor(i) : 'transparent'"
                  [class.text-canvas]="selectedAccountId() === account.id"
                  [class.text-text-muted]="selectedAccountId() !== account.id"
                  (click)="selectAccount(account.id)">
            <span class="inline-block h-2.5 w-2.5 rounded-full"
                  [style.background-color]="accountDotColor(i)"></span>
            {{ account.name }}
          </button>
        }
        <button type="button"
                class="rounded-lg border border-dashed border-border min-h-8 px-3 py-1.5 text-xs text-text-muted hover:border-ib-cyan/50 hover:text-ib-cyan transition-colors"
                (click)="accountModalRef().open()">
          <app-icon name="settings" size="12" class="inline -mt-0.5" /> Gérer
        </button>
      </nav>
    </header>

    <!-- ═══ KPI Cards ═══ -->
    <app-bank-kpi-grid
      [currentBalance]="currentBalance()"
      [totalIncome]="totalIncome()"
      [totalMonthlyExpenses]="totalMonthlyExpenses()"
      [totalAnnualExpenses]="totalAnnualExpenses()"
      [monthlyAnnualExpenses]="monthlyAnnualExpenses()"
      [totalMonthSpendings]="totalMonthSpendings()"
      [endOfMonthBalance]="endOfMonthBalance()"
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
      [selectedAccountId]="selectedAccountId()"
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
      [currentBalance]="currentBalance()" />

    <!-- ═══ Modals ═══ -->
    <app-modal-dialog #accountModal title="Gestion des comptes" (closed)="resetAccountForm()">
      @if (accountModal.isOpen()) {
        <div class="space-y-6">
          <!-- Liste des comptes existants -->
          @if (accounts().length > 0) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Comptes existants</p>
              <div class="rounded-xl border border-border overflow-hidden divide-y divide-border/30">
                @for (account of accounts(); track account.id; let i = $index) {
                  <div class="px-4 py-3 hover:bg-hover/30 transition-colors space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex items-center gap-2">
                          <span class="inline-block h-3 w-3 rounded-full" [style.background-color]="accountDotColor(i)"></span>
                          <span class="inline-block h-4 w-4 rounded-md" [style.background-color]="accountColor(i)"></span>
                        </span>
                        <span class="text-sm font-medium text-text-primary">{{ account.name }}</span>
                      </div>
                      <button type="button"
                              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                              [title]="'Supprimer — ' + account.name"
                              [attr.aria-label]="'Supprimer le compte ' + account.name"
                              (click)="deleteAccount(account)">
                        <app-icon name="trash" size="14" />
                      </button>
                    </div>
                    <div class="flex items-center gap-2 pl-10">
                      <label class="text-[11px] text-text-muted whitespace-nowrap">Solde initial</label>
                      <input type="number" step="0.01"
                             class="w-32 rounded-lg border border-border bg-raised px-2 py-1 text-xs font-mono text-text-primary text-right"
                             [value]="account.initialBalance"
                             (change)="updateAccountBalance(account.id, $event)" />
                      <span class="text-[11px] text-text-muted">&euro;</span>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Ajouter un nouveau compte -->
          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Ajouter un compte</p>
            <form (ngSubmit)="createAccount()" class="space-y-3">
              <div>
                <label for="acc-name" class="block text-sm font-medium text-text-muted mb-1">Nom <span aria-hidden="true">*</span></label>
                <input id="acc-name" type="text" [ngModel]="newAccountName()" (ngModelChange)="newAccountName.set($event)" name="name"
                       class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                       placeholder="Ex: Compte courant, Compte joint..." />
              </div>
              <div>
                <label for="acc-balance" class="block text-sm font-medium text-text-muted mb-1">Solde de départ</label>
                <div class="relative">
                  <input id="acc-balance" type="number" step="0.01" [ngModel]="newAccountBalance()" (ngModelChange)="newAccountBalance.set($event)" name="balance"
                         class="w-full rounded-lg border border-border bg-raised px-3 py-2 pr-8 text-sm font-mono text-text-primary"
                         placeholder="0.00" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">&euro;</span>
                </div>
                <p class="mt-1 text-xs text-text-muted">Solde actuel de votre compte en banque</p>
              </div>
              <p class="text-xs text-text-muted">Les couleurs sont attribuées automatiquement.</p>
              <footer class="flex justify-end gap-3 pt-2">
                <button type="button"
                        class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
                        (click)="accountModalRef().close()">
                  Fermer
                </button>
                <button type="submit" [disabled]="!newAccountName().trim()"
                        class="rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-cyan/90 transition-colors disabled:opacity-50">
                  Ajouter
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
  private readonly getEntries = inject(GetRecurringEntriesUseCase);
  private readonly createEntryUC = inject(CreateRecurringEntryUseCase);
  private readonly updateEntryUC = inject(UpdateRecurringEntryUseCase);
  private readonly deleteEntryUC = inject(DeleteRecurringEntryUseCase);
  private readonly getMembersUC = inject(GetMembersUseCase);
  private readonly getAccountsUC = inject(GetBankAccountsUseCase);
  private readonly createAccountUC = inject(CreateBankAccountUseCase);
  private readonly updateAccountUC = inject(UpdateBankAccountUseCase);
  private readonly deleteAccountUC = inject(DeleteBankAccountUseCase);
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly createArchiveUC = inject(CreateSalaryArchiveUseCase);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  protected readonly accountModalRef = viewChild.required<ModalDialog>('accountModal');

  private readonly _refresh = signal(0);
  private readonly _refreshAccounts = signal(0);

  private readonly allEntries = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getEntries.execute())),
    { initialValue: [] },
  );

  protected readonly accounts = toSignal(
    toObservable(this._refreshAccounts).pipe(switchMap(() => this.getAccountsUC.execute())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.getMembersUC.execute(), { initialValue: [] });

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

  // Virements : ceux du compte sélectionné (source) + ceux qui arrivent sur ce compte (cible)
  protected readonly transfers = computed(() => {
    const accountId = this.selectedAccountId();
    const all = this.allEntries().filter(e => e.type === 'transfer' && this.isActive(e));
    if (accountId === null) return all;
    return all.filter(e => e.accountId === accountId || e.toAccountId === accountId);
  });

  // Virements récurrents (avec dayOfMonth)
  protected readonly recurringTransfers = computed(() =>
    this.transfers().filter(e => e.dayOfMonth != null)
  );

  // Virements ponctuels (avec date, sans dayOfMonth)
  protected readonly oneTimeTransfers = computed(() =>
    this.transfers().filter(e => !e.dayOfMonth && !!e.date)
  );

  // Virements ponctuels du mois sélectionné
  protected readonly monthOneTimeTransfers = computed(() => {
    const ym = this.spendingMonth();
    return this.oneTimeTransfers()
      .filter(e => e.date!.startsWith(ym))
      .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  });

  // Virements sortants du compte sélectionné (débit) — récurrents uniquement
  private readonly outgoingTransfers = computed(() => {
    const accountId = this.selectedAccountId();
    return this.recurringTransfers().filter(e => e.accountId === accountId);
  });

  // Virements entrants sur le compte sélectionné (crédit) — récurrents uniquement
  private readonly incomingTransfers = computed(() => {
    const accountId = this.selectedAccountId();
    return this.recurringTransfers().filter(e => e.toAccountId === accountId);
  });

  protected readonly spendingMonth = signal(new Date().toISOString().slice(0, 7));

  protected readonly spendingMonthLabel = computed(() => {
    const [y, m] = this.spendingMonth().split('-');
    const MONTHS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return `${MONTHS[Number(m) - 1]} ${y}`;
  });

  protected readonly incomesLabel = computed(() => {
    const list = this.incomes();
    if (list.length === 1) return list[0].label;
    return `${list.length} sources`;
  });

  protected readonly monthlyExpensesLabel = computed(() =>
    `${this.passedExpenses().length}/${this.monthlyExpenses().length} passés`
  );

  protected readonly monthSpendingsLabel = computed(() => {
    const count = this.monthSpendings().length;
    return `${count} dépense${count > 1 ? 's' : ''} en ${this.spendingMonthLabel()}`;
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

  protected readonly today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  protected readonly currentDay = new Date().getDate();

  // Jour du salaire principal (premier revenu avec dayOfMonth, sinon 1)
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

  protected readonly totalIncome = computed(() =>
    this.incomes().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly totalMonthlyExpenses = computed(() =>
    this.monthlyExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly totalAnnualExpenses = computed(() =>
    this.annualExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly monthlyAnnualExpenses = computed(() =>
    this.totalAnnualExpenses() / 12
  );
  protected readonly totalMonthSpendings = computed(() =>
    this.monthSpendings().reduce((s, e) => s + Number(e.amount), 0)
  );

  // Prélèvements passés/à venir dans le cycle salaire
  protected readonly passedExpenses = computed(() =>
    this.monthlyExpenses().filter(e => this.isExpensePassed(e))
  );
  protected readonly upcomingExpenses = computed(() =>
    this.monthlyExpenses().filter(e => !this.isExpensePassed(e))
  );
  protected readonly totalPassedExpenses = computed(() =>
    this.passedExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );
  protected readonly totalUpcomingExpenses = computed(() =>
    this.upcomingExpenses().reduce((s, e) => s + Number(e.amount), 0)
  );

  // Virements ponctuels sortants/entrants du mois (tous considérés comme passés)
  protected readonly totalOneTimeOutgoing = computed(() => {
    const accountId = this.selectedAccountId();
    return this.monthOneTimeTransfers()
      .filter(e => e.accountId === accountId)
      .reduce((s, e) => s + Number(e.amount), 0);
  });
  protected readonly totalOneTimeIncoming = computed(() => {
    const accountId = this.selectedAccountId();
    return this.monthOneTimeTransfers()
      .filter(e => e.toAccountId === accountId)
      .reduce((s, e) => s + Number(e.amount), 0);
  });

  // Virements passés/à venir (cycle salaire pour récurrents + ponctuels du mois)
  private readonly passedOutgoing = computed(() =>
    this.outgoingTransfers().filter(e => this.isExpensePassed(e)).reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeOutgoing()
  );
  private readonly passedIncoming = computed(() =>
    this.incomingTransfers().filter(e => this.isExpensePassed(e)).reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeIncoming()
  );
  private readonly totalOutgoing = computed(() =>
    this.outgoingTransfers().reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeOutgoing()
  );
  private readonly totalIncoming = computed(() =>
    this.incomingTransfers().reduce((s, e) => s + Number(e.amount), 0)
    + this.totalOneTimeIncoming()
  );

  protected readonly totalAllExpenses = computed(() =>
    this.totalMonthlyExpenses() + this.monthlyAnnualExpenses() + this.totalMonthSpendings() + this.totalOutgoing()
  );

  // Solde actuel = initial + revenus + virements entrants passés - prélèvements passés - virements sortants passés - annuels/12 - dépenses
  protected readonly currentBalance = computed(() =>
    this.selectedInitialBalance() + this.totalIncome() + this.passedIncoming()
    - this.totalPassedExpenses() - this.passedOutgoing()
    - this.monthlyAnnualExpenses() - this.totalMonthSpendings()
  );

  // Solde prochain salaire = initial + revenus + virements entrants - TOUTES charges - virements sortants
  protected readonly endOfMonthBalance = computed(() =>
    this.selectedInitialBalance() + this.totalIncome() + this.totalIncoming()
    - this.totalMonthlyExpenses() - this.monthlyAnnualExpenses() - this.totalMonthSpendings() - this.totalOutgoing()
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
    for (const e of this.outgoingTransfers()) {
      events.push({ id: e.id, day: e.dayOfMonth ?? 1, label: `→ ${this.accountNameById(e.toAccountId) ?? 'Autre'} — ${e.label}`, amount: Number(e.amount), sign: '-', type: 'transfer', passed: this.isExpensePassed(e) });
    }
    for (const e of this.incomingTransfers()) {
      events.push({ id: e.id + '-in', day: e.dayOfMonth ?? 1, label: `← ${this.accountNameById(e.accountId) ?? 'Autre'} — ${e.label}`, amount: Number(e.amount), sign: '+', type: 'transfer', passed: this.isExpensePassed(e) });
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
      case 'income': return 'Nouveau revenu';
      case 'expense': return 'Nouveau prélèvement mensuel';
      case 'annual_expense': return 'Nouveau prélèvement annuel';
      case 'spending': return 'Nouvelle dépense';
      case 'transfer': return this.createTransferMode() === 'one_time' ? 'Nouveau virement ponctuel' : 'Nouveau virement automatique';
    }
  });
  protected readonly editModalTitle = computed(() => {
    switch (this.selectedEntry()?.type) {
      case 'income': return 'Modifier le revenu';
      case 'expense': return 'Modifier le prélèvement mensuel';
      case 'annual_expense': return 'Modifier le prélèvement annuel';
      case 'spending': return 'Modifier la dépense';
      case 'transfer': return 'Modifier le virement';
      default: return 'Modifier';
    }
  });

  protected readonly newAccountName = signal('');
  protected readonly newAccountBalance = signal<number>(0);

  protected readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string }>();
    const members = this.members();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      map.set(m.id, { name: `${m.firstName} ${m.lastName}`, color: PALETTE[(i + 3) % PALETTE.length] });
    }
    return map;
  });

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

  protected accountColor(index: number): string {
    return PALETTE[index % PALETTE.length];
  }

  protected accountDotColor(index: number): string {
    return PALETTE[(index + 3) % PALETTE.length];
  }

  protected prevMonth() {
    const [y, m] = this.spendingMonth().split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    this.spendingMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  protected nextMonth() {
    const [y, m] = this.spendingMonth().split('-').map(Number);
    const d = new Date(y, m, 1);
    this.spendingMonth.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  protected resetAccountForm() {
    this.newAccountName.set('');
    this.newAccountBalance.set(0);
  }

  protected async createAccount() {
    const name = this.newAccountName().trim();
    if (!name) return;
    try {
      await lastValueFrom(this.createAccountUC.execute({ name, initialBalance: this.newAccountBalance(), color: null, dotColor: null }));
      this.toaster.success('Compte créé');
      this.resetAccountForm();
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création du compte');
    }
  }

  protected async updateAccountBalance(accountId: string, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    try {
      await lastValueFrom(this.updateAccountUC.execute(accountId, { initialBalance: value }));
      this.toaster.success('Solde initial mis à jour');
      this._refreshAccounts.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la mise à jour');
    }
  }

  protected async deleteAccount(account: BankAccountModel) {
    if (!await this.confirm.confirm({ title: 'Supprimer le compte', message: `Supprimer le compte "${account.name}" ? Les entrees seront conservees sans compte.`, confirmLabel: 'Supprimer', variant: 'danger' })) return;
    try {
      await lastValueFrom(this.deleteAccountUC.execute(account.id));
      this.toaster.success('Compte supprimé');
      if (this.selectedAccountId() === account.id) {
        this.selectedAccountId.set(null);
      }
      this._refreshAccounts.update(v => v + 1);
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression du compte');
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
          title: 'Ajouter un revenu',
          message: 'Vous avez déjà des revenus enregistrés. Souhaitez-vous démarrer un nouveau cycle (archiver les anciens) ou simplement ajouter ce revenu au mois en cours ?',
          confirmLabel: 'Nouveau cycle',
          alternativeLabel: 'Ajouter au mois',
          cancelLabel: 'Annuler',
          variant: 'info',
        });

        if (choice === 'cancel') return;

        if (choice === 'confirm') {
          await this.archiveCurrentCycle();
          for (const old of this.incomes()) {
            await lastValueFrom(this.deleteEntryUC.execute(old.id));
          }
          this.toaster.success('Cycle archivé');
        }
      }

      await lastValueFrom(this.createEntryUC.execute(data));
      this.toaster.success('Entrée créée');
      this.createModalRef().close();
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la création');
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
      await lastValueFrom(this.createArchiveUC.execute(fd));
    } catch {
      // L'archivage silencieux échoue — on continue quand même
    }
  }

  protected async deleteEntry(id: string) {
    if (!await this.confirm.delete('cette entrée')) return;
    try {
      await lastValueFrom(this.deleteEntryUC.execute(id));
      this.toaster.success('Entrée supprimée');
      this._refresh.update(v => v + 1);
    } catch {
      this.toaster.error('Erreur lors de la suppression');
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
      await lastValueFrom(this.updateEntryUC.execute(id, data));
      const file = this._pendingPayslipFile;
      if (file) {
        this._pendingPayslipFile = null;
        try {
          await lastValueFrom(this.entryGateway.uploadPayslip(id, file));
          this.toaster.success('Entrée modifiée');
          this.editModalRef().close();
          this._refresh.update(v => v + 1);
        } catch {
          this.toaster.error('Erreur lors de l\'ajout de la fiche de paie');
        }
      } else {
        this.toaster.success('Entrée modifiée');
        this.editModalRef().close();
        this._refresh.update(v => v + 1);
      }
    } catch {
      this.toaster.error('Erreur lors de la modification');
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
    if (!await this.confirm.delete('la fiche de paie')) return;
    try {
      await lastValueFrom(this.entryGateway.deletePayslip(id));
      this.toaster.success('Fiche de paie supprimée');
      this._refresh.update(v => v + 1);
      const entry = this.selectedEntry();
      if (entry) {
        this.selectedEntry.set({ ...entry, payslipKey: null });
      }
    } catch {
      this.toaster.error('Erreur lors de la suppression de la fiche de paie');
    }
  }
}
