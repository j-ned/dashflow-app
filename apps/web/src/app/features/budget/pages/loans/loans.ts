import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Loan } from '../../domain/models/loan.model';
import { LoanTransaction } from '../../domain/models/loan-transaction.model';
import { HistoryEntry, LoanStatus, LoanVM } from '../../domain/loan-vm';
import { buildMemberMap } from '../../domain/member-map';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { BankAccountGateway } from '@features/budget/domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { LoanForm } from '../../components/loan-form/loan-form';
import { RecordPaymentForm } from '../../components/record-payment-form/record-payment-form';
import { MemberFilter } from '../../components/member-filter/member-filter';
import { LoanCard } from '../../components/loan-card/loan-card';
import { Icon } from '@shared/components/icon/icon';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';

const STATUS_RANK: Record<LoanStatus, number> = { overdue: 0, dueSoon: 1, ongoing: 2, settled: 3 };

@Component({
  selector: 'app-loans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ModalDialog, LoanForm, RecordPaymentForm, MemberFilter, LoanCard, Icon, TranslocoPipe],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">{{ 'budget.loan.title' | transloco }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'budget.loan.subtitle' | transloco }}</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors shadow-sm"
          (click)="openLentModal()"
        >
          <app-icon name="arrow-up-right" size="14" /> {{ 'budget.loan.lendButton' | transloco }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-ib-orange px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-orange/90 transition-colors shadow-sm"
          (click)="openBorrowedModal()"
        >
          <app-icon name="arrow-down-left" size="14" /> {{ 'budget.loan.borrowButton' | transloco }}
        </button>
      </div>
    </header>

    @if (activeMembers().length > 0) {
      <app-member-filter
        [members]="activeMembers()"
        [memberMap]="memberMap()"
        labelKey="budget.loan.filterLabel"
        allKey="budget.loan.filterAll"
        [(selected)]="filterMemberId"
      />
    }

    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between gap-3 px-5 py-3 bg-ib-blue/5 border-b border-border/50">
        <div class="flex items-center gap-2">
          <app-icon name="arrow-up-right" size="16" class="text-ib-blue" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-blue">{{ 'budget.loan.lentSection' | transloco }}</h3>
        </div>
        @if (lentVMs().length > 0) {
          <p class="text-xs text-text-muted">
            {{ 'budget.loan.toCollect' | transloco }}
            <span class="ml-1 font-mono font-semibold text-ib-blue">{{ lentTotal() | number: '1.2-2' }}&euro;</span>
          </p>
        }
      </div>
      @if (lentVMs().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2">
          @for (vm of lentVMs(); track vm.loan.id) {
            <app-loan-card
              [vm]="vm"
              [member]="memberMap().get(vm.loan.memberId ?? '') ?? null"
              (repay)="openPaymentModal($event)"
              (history)="openHistoryModal($event)"
              (edit)="openEditModal($event)"
              (remove)="deleteLoan($event.id)"
            />
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="arrow-up-right" size="32" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted mb-3">{{ 'budget.loan.noLent' | transloco }}</p>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors"
            (click)="openLentModal()"
          >
            <app-icon name="arrow-up-right" size="14" /> {{ 'budget.loan.lendButton' | transloco }}
          </button>
        </div>
      }
    </section>

    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between gap-3 px-5 py-3 bg-ib-orange/5 border-b border-border/50">
        <div class="flex items-center gap-2">
          <app-icon name="arrow-down-left" size="16" class="text-ib-orange" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">{{ 'budget.loan.borrowedSection' | transloco }}</h3>
        </div>
        @if (borrowedVMs().length > 0) {
          <p class="text-xs text-text-muted">
            {{ 'budget.loan.toRepay' | transloco }}
            <span class="ml-1 font-mono font-semibold text-ib-red">{{ borrowedTotal() | number: '1.2-2' }}&euro;</span>
          </p>
        }
      </div>
      @if (borrowedVMs().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2">
          @for (vm of borrowedVMs(); track vm.loan.id) {
            <app-loan-card
              [vm]="vm"
              [member]="memberMap().get(vm.loan.memberId ?? '') ?? null"
              (repay)="openPaymentModal($event)"
              (history)="openHistoryModal($event)"
              (edit)="openEditModal($event)"
              (remove)="deleteLoan($event.id)"
            />
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="arrow-down-left" size="32" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted mb-3">{{ 'budget.loan.noBorrowed' | transloco }}</p>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-md bg-ib-orange px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-orange/90 transition-colors"
            (click)="openBorrowedModal()"
          >
            <app-icon name="arrow-down-left" size="14" /> {{ 'budget.loan.borrowButton' | transloco }}
          </button>
        </div>
      }
    </section>

    @if (lentVMs().length > 0 || borrowedVMs().length > 0) {
      <footer class="rounded-lg border border-border bg-surface overflow-hidden">
        <div class="grid grid-cols-1 divide-y divide-border/50 sm:grid-cols-3 sm:divide-y-0 sm:divide-x">
          <div class="px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ 'budget.loan.summary.toCollect' | transloco }}</p>
            <p class="mt-1 font-mono text-lg font-bold text-ib-blue">{{ lentTotal() | number: '1.2-2' }}&euro;</p>
          </div>
          <div class="px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ 'budget.loan.summary.toRepay' | transloco }}</p>
            <p class="mt-1 font-mono text-lg font-bold text-ib-red">{{ borrowedTotal() | number: '1.2-2' }}&euro;</p>
          </div>
          <div class="px-5 py-4">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{ 'budget.loan.summary.net' | transloco }}</p>
            <p
              class="mt-1 font-mono text-lg font-bold"
              [class.text-ib-green]="netDirection() === 'positive'"
              [class.text-ib-red]="netDirection() === 'negative'"
              [class.text-text-primary]="netDirection() === 'even'"
            >{{ netAbs() | number: '1.2-2' }}&euro;</p>
            <p class="text-[11px] text-text-muted">
              @switch (netDirection()) {
                @case ('positive') { {{ 'budget.loan.summary.netPositive' | transloco }} }
                @case ('negative') { {{ 'budget.loan.summary.netNegative' | transloco }} }
                @case ('even') { {{ 'budget.loan.summary.netEven' | transloco }} }
              }
            </p>
          </div>
        </div>
      </footer>
    }

    <app-modal-dialog #lentModal [title]="'budget.loan.modal.newLent' | transloco" (closed)="onModalClosed()">
      @if (lentModal.isOpen()) {
        <app-loan-form direction="lent" [members]="members()" (submitted)="createLoan($event)" (cancelled)="lentModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog #borrowedModal [title]="'budget.loan.modal.newBorrowed' | transloco" (closed)="onModalClosed()">
      @if (borrowedModal.isOpen()) {
        <app-loan-form direction="borrowed" [members]="members()" (submitted)="createLoan($event)" (cancelled)="borrowedModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal [title]="'budget.loan.modal.edit' | transloco" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-loan-form
          [direction]="selectedLoan()?.direction ?? 'lent'"
          [initial]="selectedLoan()"
          [members]="members()"
          (submitted)="updateLoan($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog #paymentModal [title]="'budget.loan.modal.payment' | transloco" (closed)="onModalClosed()">
      @if (paymentModal.isOpen()) {
        <app-record-payment-form [accounts]="accounts()" (submitted)="recordPayment($event)" (cancelled)="paymentModal.close()" />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #historyModal
      [title]="'budget.loan.modal.history' | transloco: { person: selectedLoan()?.person ?? '' }"
      (closed)="onModalClosed()"
    >
      @if (historyModal.isOpen()) {
        @let loan = selectedLoanFresh();
        @if (loan) {
          @let repaid = loan.amount - loan.remaining;
          @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
          <div class="mb-4 rounded-lg border border-border bg-raised/40 p-4">
            <div class="grid grid-cols-3 gap-3 text-center">
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted">{{ 'budget.loan.modal.initialAmount' | transloco }}</p>
                <p class="mt-0.5 font-mono font-semibold text-text-primary">{{ loan.amount | number: '1.2-2' }}&euro;</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted">{{ 'budget.loan.repaid' | transloco }}</p>
                <p class="mt-0.5 font-mono font-semibold text-ib-green">{{ repaid | number: '1.2-2' }}&euro;</p>
              </div>
              <div>
                <p class="text-[11px] uppercase tracking-wider text-text-muted">{{ 'budget.loan.remaining' | transloco }}</p>
                <p
                  class="mt-0.5 font-mono font-semibold"
                  [class.text-ib-blue]="loan.direction === 'lent'"
                  [class.text-ib-red]="loan.direction === 'borrowed'"
                >{{ loan.remaining | number: '1.2-2' }}&euro;</p>
              </div>
            </div>
            <div class="mt-3 h-2 rounded-full bg-hover overflow-hidden">
              <div class="h-full rounded-full bg-ib-green" [style.width.%]="pct > 100 ? 100 : pct"></div>
            </div>
            <p class="mt-1 text-right text-[11px] text-text-muted">{{ 'budget.loan.modal.progress' | transloco: { pct: (pct | number: '1.0-0') } }}</p>
          </div>
        }

        @let history = selectedHistory();
        @if (history.length > 0) {
          <ul class="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
            @for (entry of history; track entry.tx.id) {
              <li class="flex items-center justify-between gap-3 px-4 py-3">
                <div class="flex min-w-0 items-center gap-3">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    [style.background-color]="'color-mix(in srgb, var(--color-ib-green) 12%, transparent)'"
                  >
                    <app-icon name="banknote" size="14" class="text-ib-green" />
                  </span>
                  <div class="min-w-0">
                    <p class="font-mono text-sm font-medium text-ib-green">+{{ entry.tx.amount | number: '1.2-2' }}&euro;</p>
                    @if (entry.tx.note) {
                      <p class="truncate text-xs text-text-muted">{{ entry.tx.note }}</p>
                    }
                  </div>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-xs text-text-muted">{{ entry.tx.date | date: 'dd/MM/yyyy' }}</p>
                  <p class="font-mono text-xs text-text-muted">
                    {{ 'budget.loan.remainingAfter' | transloco }} {{ entry.balanceAfter | number: '1.2-2' }}&euro;
                  </p>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="text-center py-8">
            <app-icon name="clock" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">{{ 'budget.loan.modal.noPayments' | transloco }}</p>
            <p class="text-xs text-text-muted mt-1">{{ 'budget.loan.modal.historyHint' | transloco }}</p>
          </div>
        }
      }
    </app-modal-dialog>
  `,
})
export class Loans {
  private readonly loanGateway = inject(LoanGateway);
  private readonly memberGateway = inject(MemberGateway);
  private readonly bankAccountGateway = inject(BankAccountGateway);
  private readonly recurringEntryGateway = inject(RecurringEntryGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly lentModalRef = viewChild.required<ModalDialog>('lentModal');
  private readonly borrowedModalRef = viewChild.required<ModalDialog>('borrowedModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly paymentModalRef = viewChild.required<ModalDialog>('paymentModal');
  private readonly historyModalRef = viewChild.required<ModalDialog>('historyModal');

  private readonly _today = new Date().toISOString().slice(0, 10);
  private readonly _dueSoonLimit = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();

  private readonly _refresh = signal(0);
  protected readonly loans = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.loanGateway.getAll())),
    { initialValue: [] },
  );

  private readonly allTransactions = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.loanGateway.getAllTransactions())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.memberGateway.getAll(), { initialValue: [] });
  protected readonly accounts = toSignal(this.bankAccountGateway.getAll(), { initialValue: [] });
  protected readonly activeMembers = computed(() => {
    const allLoans = this.loans();
    const memberIds = new Set(allLoans.map((l) => l.memberId).filter(Boolean));
    return this.members().filter((m) => memberIds.has(m.id));
  });

  // Defaults to "Tous" (null) so nothing is hidden on first view.
  protected readonly filterMemberId = signal<string | null>(null);

  // Real repayment history per loan, with capital remaining due after each operation.
  // Zero-amount rows (legacy E2EE balance snapshots) are filtered out.
  protected readonly historyByLoan = computed(() => {
    const byLoan = new Map<string, LoanTransaction[]>();
    for (const tx of this.allTransactions()) {
      if (Number(tx.amount) === 0) continue;
      const list = byLoan.get(tx.loanId);
      if (list) list.push(tx);
      else byLoan.set(tx.loanId, [tx]);
    }
    const result = new Map<string, HistoryEntry[]>();
    for (const loan of this.loans()) {
      const txs = (byLoan.get(loan.id) ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
      let remaining = Number(loan.remaining);
      const entries: HistoryEntry[] = txs.map((tx) => {
        const entry: HistoryEntry = { tx, balanceAfter: remaining };
        remaining += Number(tx.amount); // reverse chronologically: before this repayment, more was owed
        return entry;
      });
      result.set(loan.id, entries);
    }
    return result;
  });

  protected readonly lentVMs = computed(() => this.buildVMs('lent'));
  protected readonly borrowedVMs = computed(() => this.buildVMs('borrowed'));

  protected readonly lentTotal = computed(() => this.lentVMs().reduce((sum, vm) => sum + vm.loan.remaining, 0));
  protected readonly borrowedTotal = computed(() => this.borrowedVMs().reduce((sum, vm) => sum + vm.loan.remaining, 0));
  protected readonly netBalance = computed(() => this.lentTotal() - this.borrowedTotal());
  protected readonly netAbs = computed(() => Math.abs(this.netBalance()));
  protected readonly netDirection = computed<'positive' | 'negative' | 'even'>(() => {
    const n = this.netBalance();
    return n > 0 ? 'positive' : n < 0 ? 'negative' : 'even';
  });

  protected readonly selectedLoan = signal<Loan | null>(null);
  // Keeps the history-modal header in sync with the latest data after a repayment.
  protected readonly selectedLoanFresh = computed(() => {
    const sel = this.selectedLoan();
    if (!sel) return null;
    return this.loans().find((l) => l.id === sel.id) ?? sel;
  });
  protected readonly selectedHistory = computed<HistoryEntry[]>(() => {
    const loan = this.selectedLoan();
    return loan ? (this.historyByLoan().get(loan.id) ?? []) : [];
  });

  protected readonly memberMap = computed(() => buildMemberMap(this.members()));

  private buildVMs(direction: Loan['direction']): LoanVM[] {
    const fid = this.filterMemberId();
    const history = this.historyByLoan();
    const filtered = this.loans().filter(
      (l) => l.direction === direction && (!fid || l.memberId === fid),
    );
    const vms = filtered.map<LoanVM>((loan) => {
      const repaid = loan.amount - loan.remaining;
      const pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
      let status: LoanStatus;
      if (loan.remaining <= 0) status = 'settled';
      else if (loan.dueDate && loan.dueDate < this._today) status = 'overdue';
      else if (loan.dueDate && loan.dueDate <= this._dueSoonLimit) status = 'dueSoon';
      else status = 'ongoing';
      return { loan, repaid, pct, entries: history.get(loan.id) ?? [], status };
    });
    return vms.sort((a, b) => {
      if (STATUS_RANK[a.status] !== STATUS_RANK[b.status]) return STATUS_RANK[a.status] - STATUS_RANK[b.status];
      const ad = a.loan.dueDate ?? '9999-12-31';
      const bd = b.loan.dueDate ?? '9999-12-31';
      if (ad !== bd) return ad.localeCompare(bd);
      return b.loan.remaining - a.loan.remaining;
    });
  }

  protected openLentModal() {
    this.lentModalRef().open();
  }
  protected openBorrowedModal() {
    this.borrowedModalRef().open();
  }

  protected openEditModal(loan: Loan) {
    this.selectedLoan.set(loan);
    this.editModalRef().open();
  }

  protected openPaymentModal(loan: Loan) {
    this.selectedLoan.set(loan);
    this.paymentModalRef().open();
  }

  protected openHistoryModal(loan: Loan) {
    this.selectedLoan.set(loan);
    this.historyModalRef().open();
  }

  protected onModalClosed() {
    this.selectedLoan.set(null);
  }

  protected async createLoan(data: Omit<Loan, 'id'>) {
    try {
      await lastValueFrom(this.loanGateway.create(data));
      if (data.direction === 'lent') this.lentModalRef().close();
      else this.borrowedModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate(data.direction === 'lent' ? 'budget.loan.messages.lentCreated' : 'budget.loan.messages.borrowedCreated'));
    } catch {
      this.toaster.error(this._i18n.translate('budget.loan.messages.createError'));
    }
  }

  protected async updateLoan(data: Omit<Loan, 'id'>) {
    const id = this.selectedLoan()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.loanGateway.update(id, data));
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate('budget.loan.messages.updated'));
    } catch {
      this.toaster.error(this._i18n.translate('budget.loan.messages.updateError'));
    }
  }

  protected async recordPayment(event: { amount: number; date: string; accountId: string | null; note: string | null }) {
    const loan = this.selectedLoan();
    if (!loan) return;
    try {
      await lastValueFrom(this.loanGateway.recordPayment(loan.id, event.amount, event.date, event.note));
      this.paymentModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate('budget.loan.messages.paymentRecorded'));

      if (event.accountId) {
        const labelKey = loan.direction === 'borrowed' ? 'budget.loan.messages.debtRepaymentLabel' : 'budget.loan.messages.loanRepaymentLabel';
        // Repaying a debt you owe = money out (spending); being repaid on a loan
        // you granted = money in (income). Sign the bank entry accordingly.
        await lastValueFrom(
          this.recurringEntryGateway.create({
            label: this._i18n.translate(labelKey, { person: loan.person }),
            amount: event.amount,
            type: loan.direction === 'lent' ? 'income' : 'spending',
            accountId: event.accountId,
            memberId: loan.memberId,
            dayOfMonth: null,
            date: event.date || null,
            endDate: null,
            toAccountId: null,
            category: this._i18n.translate('budget.loan.messages.repaymentCategory'),
            payslipKey: null,
          }),
        );
      }
    } catch {
      this.toaster.error(this._i18n.translate('budget.loan.messages.paymentError'));
    }
  }

  protected async deleteLoan(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('budget.loan.messages.deleteTarget')))) return;
    try {
      await lastValueFrom(this.loanGateway.delete(id));
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate('budget.loan.messages.deleted'));
    } catch {
      this.toaster.error(this._i18n.translate('budget.loan.messages.deleteError'));
    }
  }
}
