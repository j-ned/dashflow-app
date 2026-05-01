import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Loan } from '../../domain/models/loan.model';
import { LoanTransaction } from '../../domain/models/loan-transaction.model';
import { GetLoansUseCase } from '../../domain/use-cases/get-loans.use-case';
import { CreateLoanUseCase } from '../../domain/use-cases/create-loan.use-case';
import { UpdateLoanUseCase } from '../../domain/use-cases/update-loan.use-case';
import { RecordLoanPaymentUseCase } from '../../domain/use-cases/record-loan-payment.use-case';
import { DeleteLoanUseCase } from '../../domain/use-cases/delete-loan.use-case';
import { GetLoanTransactionsUseCase } from '../../domain/use-cases/get-loan-transactions.use-case';
import { AddLoanTransactionUseCase } from '../../domain/use-cases/add-loan-transaction.use-case';
import { GetMembersUseCase } from '../../domain/use-cases/get-members.use-case';
import { GetBankAccountsUseCase } from '../../domain/use-cases/get-bank-accounts.use-case';
import { CreateRecurringEntryUseCase } from '../../domain/use-cases/create-recurring-entry.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { LoanForm } from '../../components/loan-form/loan-form';
import { RecordPaymentForm } from '../../components/record-payment-form/record-payment-form';
import { Icon } from '@shared/components/icon/icon';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';
import { FormsModule } from '@angular/forms';

const MEMBER_PALETTE = [
  'var(--color-ib-green)',
  'var(--color-ib-blue)',
  'var(--color-ib-purple)',
  'var(--color-ib-orange)',
  'var(--color-ib-pink)',
  'var(--color-ib-cyan)',
  'var(--color-ib-yellow)',
  'var(--color-ib-red)',
] as const;

@Component({
  selector: 'app-loans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ModalDialog, LoanForm, RecordPaymentForm, Icon, FormsModule, TranslocoPipe],
  host: { class: 'block space-y-6' },
  styles: `
    .action-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      padding: 0.375rem 0.5rem;
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--color-text-muted);
      transition: all 0.15s;
    }
    .action-label {
      max-width: 0;
      overflow: hidden;
      opacity: 0;
      white-space: nowrap;
      transition: max-width 0.25s ease, opacity 0.2s ease;
    }
    .action-btn:hover .action-label,
    .action-btn:focus-visible .action-label {
      max-width: 6rem;
      opacity: 1;
    }
  `,
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">{{ 'budget.loan.title' | transloco }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'budget.loan.subtitle' | transloco }}</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors shadow-sm"
          (click)="openLentModal()"
        >
          <app-icon name="arrow-up-right" size="14" /> {{ 'budget.loan.lendButton' | transloco }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-ib-orange px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-orange/90 transition-colors shadow-sm"
          (click)="openBorrowedModal()"
        >
          <app-icon name="arrow-down-left" size="14" /> {{ 'budget.loan.borrowButton' | transloco }}
        </button>
      </div>
    </header>

    <!-- Member filter -->
    @if (activeMembers().length > 0) {
      <div class="flex gap-2 flex-wrap items-center">
        @for (m of activeMembers(); track m.id) {
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            [style.border-color]="filterMemberId() === m.id ? memberMap().get(m.id)?.color : 'var(--border)'"
            [style.background-color]="filterMemberId() === m.id ? memberMap().get(m.id)?.color : 'transparent'"
            [class.text-canvas]="filterMemberId() === m.id"
            [class.text-text-muted]="filterMemberId() !== m.id"
            (click)="filterMemberId.set(m.id)"
          >
            <span class="inline-block h-2.5 w-2.5 rounded-full"
                  [style.background-color]="memberMap().get(m.id)?.color"></span>
            {{ m.firstName }}
          </button>
        }
      </div>
    }

    <!-- Prêtés -->
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div
        class="flex items-center justify-between px-5 py-3 bg-ib-blue/5 border-b border-border/50"
      >
        <div class="flex items-center gap-2">
          <app-icon name="arrow-up-right" size="16" class="text-ib-blue" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-blue">{{ 'budget.loan.lentSection' | transloco }}</h3>
        </div>
      </div>
      @if (filteredLentLoans().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2">
          @for (loan of filteredLentLoans(); track loan.id) {
            @let repaid = loan.amount - loan.remaining;
            @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
            <article
              class="group relative overflow-hidden border-b border-r border-border/30 p-5 transition hover:bg-ib-blue/3"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-ib-blue/10 text-ib-blue text-xs font-bold shrink-0"
                  >
                    {{ pct | number: '1.0-0' }}%
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-text-primary">{{ loan.person }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      @if (memberMap().get(loan.memberId ?? ''); as mInfo) {
                        <span class="inline-flex items-center gap-1 text-[10px] text-ib-purple">
                          @if (mInfo.color; as mc) {
                            <span
                              class="inline-block h-2 w-2 rounded-full"
                              [style.background-color]="mc"
                            ></span>
                          }
                          {{ mInfo.name }}
                        </span>
                      }
                      @if (loan.dueDay) {
                        <span
                          class="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-mono text-text-muted"
                          >le {{ loan.dueDay }}</span
                        >
                      }
                    </div>
                    @if (loan.description) {
                      <p class="text-[11px] text-text-muted mt-0.5">{{ loan.description }}</p>
                    }
                  </div>
                </div>
                <span class="text-lg font-mono font-bold text-ib-blue"
                  >{{ loan.remaining | number: '1.2-2'
                  }}<span class="text-sm ml-0.5">&euro;</span></span
                >
              </div>

              <div class="grid grid-cols-3 gap-2 text-xs mb-3">
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">{{ 'budget.loan.amount' | transloco }}</p>
                  <p class="font-mono font-medium text-text-primary">
                    {{ loan.amount | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">{{ 'budget.loan.repaid' | transloco }}</p>
                  <p class="font-mono font-medium text-ib-green">
                    {{ repaid | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">{{ 'budget.loan.remaining' | transloco }}</p>
                  <p class="font-mono font-medium text-ib-blue">
                    {{ loan.remaining | number: '1.2-2' }}&euro;
                  </p>
                </div>
              </div>

              @if (loan.date || loan.dueDate) {
                <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p class="text-[10px] text-text-muted">{{ 'budget.loan.loanDate' | transloco }}</p>
                    <p class="text-text-primary">{{ loan.date }}</p>
                  </div>
                  @if (loan.dueDate) {
                    <div>
                      <p class="text-[10px] text-text-muted">{{ 'budget.loan.dueDate' | transloco }}</p>
                      <p class="text-text-primary">{{ loan.dueDate }}</p>
                    </div>
                  }
                </div>
              }

              <div class="flex justify-between text-[10px] text-text-muted mb-1">
                <span>{{ 'budget.loan.repayment' | transloco }}</span>
                <span class="font-mono font-semibold">{{ pct | number: '1.0-0' }}%</span>
              </div>
              <div class="h-2 rounded-full bg-hover overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-ib-blue to-ib-blue/70 transition duration-500 ease-out"
                  [style.width.%]="pct > 100 ? 100 : pct"
                ></div>
              </div>

              <div class="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/30">
                <button
                  type="button"
                  class="action-btn hover:text-ib-blue hover:border-ib-blue/30"
                  [title]="'budget.loan.actions.repayTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.repayAria' | transloco: { person: loan.person }"
                  (click)="openPaymentModal(loan)"
                >
                  <app-icon name="banknote" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.repay' | transloco }}</span>
                </button>
                <button
                  type="button"
                  class="action-btn hover:text-ib-cyan hover:border-ib-cyan/30"
                  [title]="'budget.loan.actions.historyTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.historyAria' | transloco: { person: loan.person }"
                  (click)="openHistoryModal(loan)"
                >
                  <app-icon name="clock" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.history' | transloco }}</span>
                </button>
                <button
                  type="button"
                  class="action-btn hover:text-ib-yellow hover:border-ib-yellow/30"
                  [title]="'budget.loan.actions.editLentTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.editLentAria' | transloco: { person: loan.person }"
                  (click)="openEditModal(loan)"
                >
                  <app-icon name="pencil" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.edit' | transloco }}</span>
                </button>
                <button
                  type="button"
                  class="action-btn hover:text-ib-red hover:border-ib-red/30"
                  [title]="'budget.loan.actions.deleteLentTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.deleteLentAria' | transloco: { person: loan.person }"
                  (click)="deleteLoan(loan.id)"
                >
                  <app-icon name="trash" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.delete' | transloco }}</span>
                </button>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="arrow-up-right" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">{{ 'budget.loan.noLent' | transloco }}</p>
        </div>
      }
    </section>

    <!-- Empruntés -->
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div
        class="flex items-center justify-between px-5 py-3 bg-ib-orange/5 border-b border-border/50"
      >
        <div class="flex items-center gap-2">
          <app-icon name="arrow-down-left" size="16" class="text-ib-orange" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">
            {{ 'budget.loan.borrowedSection' | transloco }}
          </h3>
        </div>
      </div>
      @if (filteredBorrowedLoans().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2">
          @for (loan of filteredBorrowedLoans(); track loan.id) {
            @let repaid = loan.amount - loan.remaining;
            @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
            <article
              class="group relative overflow-hidden border-b border-r border-border/30 p-5 transition hover:bg-ib-orange/3"
            >
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-ib-orange/10 text-ib-orange text-xs font-bold shrink-0"
                  >
                    {{ pct | number: '1.0-0' }}%
                  </div>
                  <div>
                    <p class="text-sm font-semibold text-text-primary">{{ loan.person }}</p>
                    <div class="flex items-center gap-2 mt-0.5">
                      @if (memberMap().get(loan.memberId ?? ''); as mInfo) {
                        <span class="inline-flex items-center gap-1 text-[10px] text-ib-purple">
                          @if (mInfo.color; as mc) {
                            <span
                              class="inline-block h-2 w-2 rounded-full"
                              [style.background-color]="mc"
                            ></span>
                          }
                          {{ mInfo.name }}
                        </span>
                      }
                      @if (loan.dueDay) {
                        <span
                          class="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-mono text-text-muted"
                          >le {{ loan.dueDay }}</span
                        >
                      }
                    </div>
                    @if (loan.description) {
                      <p class="text-[11px] text-text-muted mt-0.5">{{ loan.description }}</p>
                    }
                  </div>
                </div>
                <span class="text-lg font-mono font-bold text-ib-red"
                  >{{ loan.remaining | number: '1.2-2'
                  }}<span class="text-sm ml-0.5">&euro;</span></span
                >
              </div>

              <div class="grid grid-cols-3 gap-2 text-xs mb-3">
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">{{ 'budget.loan.amount' | transloco }}</p>
                  <p class="font-mono font-medium text-text-primary">
                    {{ loan.amount | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">{{ 'budget.loan.repaid' | transloco }}</p>
                  <p class="font-mono font-medium text-ib-green">
                    {{ repaid | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">{{ 'budget.loan.remaining' | transloco }}</p>
                  <p class="font-mono font-medium text-ib-red">
                    {{ loan.remaining | number: '1.2-2' }}&euro;
                  </p>
                </div>
              </div>

              @if (loan.date || loan.dueDate) {
                <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p class="text-[10px] text-text-muted">{{ 'budget.loan.borrowDate' | transloco }}</p>
                    <p class="text-text-primary">{{ loan.date }}</p>
                  </div>
                  @if (loan.dueDate) {
                    <div>
                      <p class="text-[10px] text-text-muted">{{ 'budget.loan.dueDate' | transloco }}</p>
                      <p class="text-text-primary">{{ loan.dueDate }}</p>
                    </div>
                  }
                </div>
              }

              <div class="flex justify-between text-[10px] text-text-muted mb-1">
                <span>{{ 'budget.loan.repayment' | transloco }}</span>
                <span class="font-mono font-semibold">{{ pct | number: '1.0-0' }}%</span>
              </div>
              <div class="h-2 rounded-full bg-hover overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-ib-orange to-ib-orange/70 transition duration-500 ease-out"
                  [style.width.%]="pct > 100 ? 100 : pct"
                ></div>
              </div>

              <div class="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/30">
                <button
                  type="button"
                  class="action-btn hover:text-ib-blue hover:border-ib-blue/30"
                  [title]="'budget.loan.actions.repayTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.repayAria' | transloco: { person: loan.person }"
                  (click)="openPaymentModal(loan)"
                >
                  <app-icon name="banknote" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.repay' | transloco }}</span>
                </button>
                <button
                  type="button"
                  class="action-btn hover:text-ib-cyan hover:border-ib-cyan/30"
                  [title]="'budget.loan.actions.historyTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.historyAria' | transloco: { person: loan.person }"
                  (click)="openHistoryModal(loan)"
                >
                  <app-icon name="clock" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.history' | transloco }}</span>
                </button>
                <button
                  type="button"
                  class="action-btn hover:text-ib-yellow hover:border-ib-yellow/30"
                  [title]="'budget.loan.actions.editLentTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.editBorrowedAria' | transloco: { person: loan.person }"
                  (click)="openEditModal(loan)"
                >
                  <app-icon name="pencil" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.edit' | transloco }}</span>
                </button>
                <button
                  type="button"
                  class="action-btn hover:text-ib-red hover:border-ib-red/30"
                  [title]="'budget.loan.actions.deleteLentTitle' | transloco: { person: loan.person }"
                  [attr.aria-label]="'budget.loan.actions.deleteBorrowedAria' | transloco: { person: loan.person }"
                  (click)="deleteLoan(loan.id)"
                >
                  <app-icon name="trash" size="13" />
                  <span class="action-label">{{ 'budget.loan.actions.delete' | transloco }}</span>
                </button>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="arrow-down-left" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">{{ 'budget.loan.noBorrowed' | transloco }}</p>
        </div>
      }
    </section>

    <app-modal-dialog #lentModal [title]="'budget.loan.modal.newLent' | transloco" (closed)="onModalClosed()">
      @if (lentModal.isOpen()) {
        <app-loan-form
          direction="lent"
          [members]="members()"
          (submitted)="createLoan($event)"
          (cancelled)="lentModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog #borrowedModal [title]="'budget.loan.modal.newBorrowed' | transloco" (closed)="onModalClosed()">
      @if (borrowedModal.isOpen()) {
        <app-loan-form
          direction="borrowed"
          [members]="members()"
          (submitted)="createLoan($event)"
          (cancelled)="borrowedModal.close()"
        />
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
        <app-record-payment-form
          [accounts]="accounts()"
          (submitted)="recordPayment($event)"
          (cancelled)="paymentModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #historyModal
      [title]="'budget.loan.modal.history' | transloco: { person: selectedLoan()?.person ?? '' }"
      (closed)="onModalClosed()"
    >
      @if (historyModal.isOpen()) {
        <div class="space-y-4">
          <form class="flex gap-2 items-end" (ngSubmit)="addManualTransaction()">
            <div class="flex-1">
              <label for="tx-amount" class="text-xs text-text-muted">{{ 'budget.loan.modal.amount' | transloco }}</label>
              <input
                id="tx-amount"
                type="number"
                step="0.01"
                min="0.01"
                class="form-input mono"
                [value]="manualTxAmount()"
                (input)="manualTxAmount.set(+inputValue($event))"
              />
            </div>
            <div class="flex-1">
              <label for="tx-date" class="text-xs text-text-muted">{{ 'budget.loan.modal.date' | transloco }}</label>
              <input
                id="tx-date"
                type="date"
                class="form-input"
                [value]="manualTxDate()"
                (input)="manualTxDate.set(inputValue($event))"
              />
            </div>
            <button
              type="submit"
              [disabled]="!manualTxAmount() || !manualTxDate()"
              class="rounded-lg bg-ib-cyan px-3 py-2 text-xs font-medium text-canvas hover:bg-ib-cyan/90 transition-colors disabled:opacity-50"
            >
              {{ 'budget.loan.modal.submitAdd' | transloco }}
            </button>
          </form>

          @if (transactions().length > 0) {
            <div class="rounded-xl border border-border overflow-hidden">
              <table class="w-full text-sm">
                <thead>
                  <tr
                    class="bg-raised/50 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                  >
                    <th class="px-4 py-2.5">{{ 'budget.loan.modal.tableDate' | transloco }}</th>
                    <th class="px-4 py-2.5 text-right">{{ 'budget.loan.modal.tableAmount' | transloco }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border/30">
                  @for (tx of transactions(); track tx.id) {
                    <tr class="hover:bg-hover/30 transition-colors">
                      <td class="px-4 py-2.5 text-text-primary">
                        {{ tx.date | date: 'dd/MM/yyyy' }}
                      </td>
                      <td class="px-4 py-2.5 text-right font-mono font-medium text-ib-green">
                        {{ tx.amount | number: '1.2-2' }}&euro;
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <div class="text-center py-8">
              <app-icon name="clock" size="32" class="text-text-muted/20 mx-auto mb-2" />
              <p class="text-sm text-text-muted">{{ 'budget.loan.modal.noPayments' | transloco }}</p>
            </div>
          }
        </div>
      }
    </app-modal-dialog>
  `,
})
export class Loans {
  private readonly getLoans = inject(GetLoansUseCase);
  private readonly createLoanUC = inject(CreateLoanUseCase);
  private readonly updateLoanUC = inject(UpdateLoanUseCase);
  private readonly recordPaymentUC = inject(RecordLoanPaymentUseCase);
  private readonly deleteLoanUC = inject(DeleteLoanUseCase);
  private readonly getTransactionsUC = inject(GetLoanTransactionsUseCase);
  private readonly addTransactionUC = inject(AddLoanTransactionUseCase);
  private readonly getMembersUC = inject(GetMembersUseCase);
  private readonly getAccountsUC = inject(GetBankAccountsUseCase);
  private readonly createEntryUC = inject(CreateRecurringEntryUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly lentModalRef = viewChild.required<ModalDialog>('lentModal');
  private readonly borrowedModalRef = viewChild.required<ModalDialog>('borrowedModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly paymentModalRef = viewChild.required<ModalDialog>('paymentModal');
  private readonly historyModalRef = viewChild.required<ModalDialog>('historyModal');

  private readonly _refresh = signal(0);
  protected readonly loans = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getLoans.execute())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.getMembersUC.execute(), { initialValue: [] });
  protected readonly accounts = toSignal(this.getAccountsUC.execute(), { initialValue: [] });
  protected readonly activeMembers = computed(() => {
    const allLoans = this.loans();
    const memberIds = new Set(allLoans.map((l) => l.memberId).filter(Boolean));
    return this.members().filter((m) => memberIds.has(m.id));
  });

  protected readonly filterMemberId = linkedSignal<string | null>(() => {
    const active = this.activeMembers();
    return active.length > 0 ? active[0].id : null;
  });

  protected readonly filteredLentLoans = computed(() => {
    const fid = this.filterMemberId();
    const lent = this.loans().filter((l) => l.direction === 'lent');
    if (!fid) return lent;
    return lent.filter((l) => l.memberId === fid);
  });

  protected readonly filteredBorrowedLoans = computed(() => {
    const fid = this.filterMemberId();
    const borrowed = this.loans().filter((l) => l.direction === 'borrowed');
    if (!fid) return borrowed;
    return borrowed.filter((l) => l.memberId === fid);
  });

  protected readonly selectedLoan = signal<Loan | null>(null);
  protected readonly transactions = signal<LoanTransaction[]>([]);
  protected readonly manualTxAmount = signal(0);
  protected readonly manualTxDate = signal(new Date().toISOString().slice(0, 10));

  protected readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string }>();
    const members = this.members();
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      map.set(m.id, {
        name: `${m.firstName} ${m.lastName}`,
        color: MEMBER_PALETTE[i % MEMBER_PALETTE.length],
      });
    }
    return map;
  });

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

  protected async openHistoryModal(loan: Loan) {
    this.selectedLoan.set(loan);
    const txs = await lastValueFrom(this.getTransactionsUC.execute(loan.id));
    this.transactions.set(txs);
    this.historyModalRef().open();
  }

  protected async addManualTransaction() {
    const loan = this.selectedLoan();
    const amount = this.manualTxAmount();
    const date = this.manualTxDate();
    if (!loan || !amount || !date) return;
    const tx = await lastValueFrom(this.addTransactionUC.execute(loan.id, { amount, date }));
    this.transactions.update((txs) => [tx, ...txs]);
    this.manualTxAmount.set(0);
    this.manualTxDate.set(new Date().toISOString().slice(0, 10));
  }

  protected onModalClosed() {
    this.selectedLoan.set(null);
    this.transactions.set([]);
    this.manualTxAmount.set(0);
    this.manualTxDate.set(new Date().toISOString().slice(0, 10));
  }

  protected async createLoan(data: Omit<Loan, 'id'>) {
    try {
      await lastValueFrom(this.createLoanUC.execute(data));
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
      await lastValueFrom(this.updateLoanUC.execute(id, data));
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate('budget.loan.messages.updated'));
    } catch {
      this.toaster.error(this._i18n.translate('budget.loan.messages.updateError'));
    }
  }

  protected async recordPayment(event: { amount: number; date: string; accountId: string | null }) {
    const loan = this.selectedLoan();
    if (!loan) return;
    try {
      await lastValueFrom(this.recordPaymentUC.execute(loan.id, event.amount, event.date));
      this.paymentModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate('budget.loan.messages.paymentRecorded'));

      if (event.accountId) {
        const labelKey = loan.direction === 'borrowed' ? 'budget.loan.messages.debtRepaymentLabel' : 'budget.loan.messages.loanRepaymentLabel';
        await lastValueFrom(
          this.createEntryUC.execute({
            label: this._i18n.translate(labelKey, { person: loan.person }),
            amount: event.amount,
            type: 'spending',
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
      await lastValueFrom(this.deleteLoanUC.execute(id));
      this._refresh.update((v) => v + 1);
      this.toaster.success(this._i18n.translate('budget.loan.messages.deleted'));
    } catch {
      this.toaster.error(this._i18n.translate('budget.loan.messages.deleteError'));
    }
  }

  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
