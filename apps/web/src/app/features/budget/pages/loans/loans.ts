import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
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
import { UpdateMemberColorUseCase } from '../../domain/use-cases/update-member-color.use-case';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-loans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, ModalDialog, LoanForm, RecordPaymentForm, Icon, FormsModule],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Prets & Dettes</h2>
        <p class="mt-1 text-sm text-text-muted">Suivez vos prets familiaux et dettes</p>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-white hover:bg-ib-blue/90 transition-colors shadow-sm"
          (click)="openLentModal()"
        >
          <app-icon name="arrow-up-right" size="14" /> Preter
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-lg bg-ib-orange px-4 py-2 text-sm font-medium text-white hover:bg-ib-orange/90 transition-colors shadow-sm"
          (click)="openBorrowedModal()"
        >
          <app-icon name="arrow-down-left" size="14" /> Emprunter
        </button>
      </div>
    </header>

    <!-- Member filter -->
    @if (activeMembers().length > 0) {
      <div class="flex gap-2 flex-wrap items-center">
        @for (m of activeMembers(); track m.id) {
          <div
            class="inline-flex items-center rounded-full border transition-colors"
            [style.border-color]="
              filterMemberId() === m.id ? m.color || 'var(--color-ib-green)' : 'var(--border)'
            "
            [style.background-color]="
              filterMemberId() === m.id ? m.color || 'var(--color-ib-green)' : 'transparent'
            "
          >
            <label class="relative cursor-pointer pl-2.5 py-1 shrink-0" title="Changer la couleur">
              <span
                class="inline-block h-3 w-3 rounded-full border-2 hover:scale-125 transition-transform"
                [style.background-color]="m.color || 'var(--color-text-muted)'"
                [style.border-color]="
                  filterMemberId() === m.id ? 'rgba(255,255,255,0.4)' : 'var(--border)'
                "
              ></span>
              <input
                type="color"
                class="absolute inset-0 h-0 w-0 opacity-0"
                [value]="m.color || '#6aab73'"
                (click)="$event.stopPropagation()"
                (change)="updateMemberColor(m.id, $event)"
              />
            </label>
            <button
              type="button"
              class="pr-3 pl-1.5 py-1 text-xs font-medium transition-colors"
              [class.text-white]="filterMemberId() === m.id"
              [class.text-text-muted]="filterMemberId() !== m.id"
              (click)="filterMemberId.set(m.id)"
            >
              {{ m.firstName }}
            </button>
          </div>
        }
      </div>
    }

    <!-- Pretes -->
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div
        class="flex items-center justify-between px-5 py-3 bg-ib-blue/5 border-b border-border/50"
      >
        <div class="flex items-center gap-2">
          <app-icon name="arrow-up-right" size="16" class="text-ib-blue" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-blue">Pretes</h3>
        </div>
      </div>
      @if (filteredLentLoans().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2">
          @for (loan of filteredLentLoans(); track loan.id) {
            @let repaid = loan.amount - loan.remaining;
            @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
            <article
              class="group relative overflow-hidden border-b border-r border-border/30 p-5 transition-all hover:bg-ib-blue/3"
            >
              <div class="absolute inset-y-0 left-0 w-1 bg-ib-blue"></div>
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
                      @if (memberName(loan.memberId); as mName) {
                        <span class="inline-flex items-center gap-1 text-[10px] text-ib-purple">
                          @if (memberColor(loan.memberId); as mc) {
                            <span
                              class="inline-block h-2 w-2 rounded-full"
                              [style.background-color]="mc"
                            ></span>
                          }
                          {{ mName }}
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
                  <p class="text-[10px] text-text-muted">Montant</p>
                  <p class="font-mono font-medium text-text-primary">
                    {{ loan.amount | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">Rembourse</p>
                  <p class="font-mono font-medium text-ib-green">
                    {{ repaid | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">Restant</p>
                  <p class="font-mono font-medium text-ib-blue">
                    {{ loan.remaining | number: '1.2-2' }}&euro;
                  </p>
                </div>
              </div>

              @if (loan.date || loan.dueDate) {
                <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p class="text-[10px] text-text-muted">Date du pret</p>
                    <p class="text-text-primary">{{ loan.date }}</p>
                  </div>
                  @if (loan.dueDate) {
                    <div>
                      <p class="text-[10px] text-text-muted">Echeance</p>
                      <p class="text-text-primary">{{ loan.dueDate }}</p>
                    </div>
                  }
                </div>
              }

              <div class="flex justify-between text-[10px] text-text-muted mb-1">
                <span>Remboursement</span>
                <span class="font-mono font-semibold">{{ pct | number: '1.0-0' }}%</span>
              </div>
              <div class="h-2 rounded-full bg-hover overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-ib-blue to-ib-blue/70 transition-all duration-500 ease-out"
                  [style.width.%]="pct > 100 ? 100 : pct"
                ></div>
              </div>

              <div class="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/30">
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors"
                  (click)="openPaymentModal(loan)"
                  aria-label="Remboursement"
                >
                  <app-icon name="banknote" size="13" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
                  (click)="openHistoryModal(loan)"
                  aria-label="Historique"
                >
                  <app-icon name="clock" size="13" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                  (click)="openEditModal(loan)"
                  aria-label="Modifier"
                >
                  <app-icon name="pencil" size="13" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                  (click)="deleteLoan(loan.id)"
                  aria-label="Supprimer"
                >
                  <app-icon name="trash" size="13" />
                </button>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="arrow-up-right" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">Aucun pret en cours</p>
        </div>
      }
    </section>

    <!-- Empruntes -->
    <section class="rounded-xl border border-border bg-surface overflow-hidden">
      <div
        class="flex items-center justify-between px-5 py-3 bg-ib-orange/5 border-b border-border/50"
      >
        <div class="flex items-center gap-2">
          <app-icon name="arrow-down-left" size="16" class="text-ib-orange" />
          <h3 class="text-[11px] font-semibold uppercase tracking-wider text-ib-orange">
            Empruntes
          </h3>
        </div>
      </div>
      @if (filteredBorrowedLoans().length > 0) {
        <div class="grid grid-cols-1 md:grid-cols-2">
          @for (loan of filteredBorrowedLoans(); track loan.id) {
            @let repaid = loan.amount - loan.remaining;
            @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
            <article
              class="group relative overflow-hidden border-b border-r border-border/30 p-5 transition-all hover:bg-ib-orange/3"
            >
              <div class="absolute inset-y-0 left-0 w-1 bg-ib-orange"></div>
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
                      @if (memberName(loan.memberId); as mName) {
                        <span class="inline-flex items-center gap-1 text-[10px] text-ib-purple">
                          @if (memberColor(loan.memberId); as mc) {
                            <span
                              class="inline-block h-2 w-2 rounded-full"
                              [style.background-color]="mc"
                            ></span>
                          }
                          {{ mName }}
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
                  <p class="text-[10px] text-text-muted">Montant</p>
                  <p class="font-mono font-medium text-text-primary">
                    {{ loan.amount | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">Rembourse</p>
                  <p class="font-mono font-medium text-ib-green">
                    {{ repaid | number: '1.2-2' }}&euro;
                  </p>
                </div>
                <div class="rounded-lg bg-canvas p-2 border border-border/30">
                  <p class="text-[10px] text-text-muted">Restant</p>
                  <p class="font-mono font-medium text-ib-red">
                    {{ loan.remaining | number: '1.2-2' }}&euro;
                  </p>
                </div>
              </div>

              @if (loan.date || loan.dueDate) {
                <div class="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div>
                    <p class="text-[10px] text-text-muted">Date de l'emprunt</p>
                    <p class="text-text-primary">{{ loan.date }}</p>
                  </div>
                  @if (loan.dueDate) {
                    <div>
                      <p class="text-[10px] text-text-muted">Echeance</p>
                      <p class="text-text-primary">{{ loan.dueDate }}</p>
                    </div>
                  }
                </div>
              }

              <div class="flex justify-between text-[10px] text-text-muted mb-1">
                <span>Remboursement</span>
                <span class="font-mono font-semibold">{{ pct | number: '1.0-0' }}%</span>
              </div>
              <div class="h-2 rounded-full bg-hover overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-ib-orange to-ib-orange/70 transition-all duration-500 ease-out"
                  [style.width.%]="pct > 100 ? 100 : pct"
                ></div>
              </div>

              <div class="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-border/30">
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors"
                  (click)="openPaymentModal(loan)"
                  aria-label="Remboursement"
                >
                  <app-icon name="banknote" size="13" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
                  (click)="openHistoryModal(loan)"
                  aria-label="Historique"
                >
                  <app-icon name="clock" size="13" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
                  (click)="openEditModal(loan)"
                  aria-label="Modifier"
                >
                  <app-icon name="pencil" size="13" />
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                  (click)="deleteLoan(loan.id)"
                  aria-label="Supprimer"
                >
                  <app-icon name="trash" size="13" />
                </button>
              </div>
            </article>
          }
        </div>
      } @else {
        <div class="text-center py-12">
          <app-icon name="arrow-down-left" size="32" class="text-text-muted/20 mx-auto mb-2" />
          <p class="text-sm text-text-muted">Aucune dette en cours</p>
        </div>
      }
    </section>

    <app-modal-dialog #lentModal title="Nouveau pret" (closed)="onModalClosed()">
      <app-loan-form
        direction="lent"
        [members]="members()"
        (submitted)="createLoan($event)"
        (cancelled)="lentModal.close()"
      />
    </app-modal-dialog>

    <app-modal-dialog #borrowedModal title="Nouvel emprunt" (closed)="onModalClosed()">
      <app-loan-form
        direction="borrowed"
        [members]="members()"
        (submitted)="createLoan($event)"
        (cancelled)="borrowedModal.close()"
      />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier" (closed)="onModalClosed()">
      <app-loan-form
        [direction]="selectedLoan()?.direction ?? 'lent'"
        [initial]="selectedLoan()"
        [members]="members()"
        (submitted)="updateLoan($event)"
        (cancelled)="editModal.close()"
      />
    </app-modal-dialog>

    <app-modal-dialog #paymentModal title="Remboursement" (closed)="onModalClosed()">
      <app-record-payment-form
        [accounts]="accounts()"
        (submitted)="recordPayment($event)"
        (cancelled)="paymentModal.close()"
      />
    </app-modal-dialog>

    <app-modal-dialog
      #historyModal
      [title]="'Historique — ' + (selectedLoan()?.person ?? '')"
      (closed)="onModalClosed()"
    >
      <div class="space-y-4">
        <form class="flex gap-2 items-end" (ngSubmit)="addManualTransaction()">
          <div class="flex-1">
            <label for="tx-amount" class="text-xs text-text-muted">Montant</label>
            <input
              id="tx-amount"
              type="number"
              step="0.01"
              min="0.01"
              class="form-input mono"
              [value]="manualTxAmount()"
              (input)="manualTxAmount.set(+$any($event.target).value)"
            />
          </div>
          <div class="flex-1">
            <label for="tx-date" class="text-xs text-text-muted">Date</label>
            <input
              id="tx-date"
              type="date"
              class="form-input"
              [value]="manualTxDate()"
              (input)="manualTxDate.set($any($event.target).value)"
            />
          </div>
          <button
            type="submit"
            [disabled]="!manualTxAmount() || !manualTxDate()"
            class="rounded-lg bg-ib-cyan px-3 py-2 text-xs font-medium text-white hover:bg-ib-cyan/90 transition-colors disabled:opacity-50"
          >
            Ajouter
          </button>
        </form>

        @if (transactions().length > 0) {
          <div class="rounded-xl border border-border overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr
                  class="bg-raised/50 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                >
                  <th class="px-4 py-2.5">Date</th>
                  <th class="px-4 py-2.5 text-right">Montant</th>
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
            <p class="text-sm text-text-muted">Aucun remboursement enregistre</p>
          </div>
        }
      </div>
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
  private readonly updateMemberColorUC = inject(UpdateMemberColorUseCase);
  private readonly getAccountsUC = inject(GetBankAccountsUseCase);
  private readonly createEntryUC = inject(CreateRecurringEntryUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

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
  protected readonly filterMemberId = signal<string | null>(null);

  protected readonly activeMembers = computed(() => {
    const allLoans = this.loans();
    const memberIds = new Set(allLoans.map((l) => l.memberId).filter(Boolean));
    return this.members().filter((m) => memberIds.has(m.id));
  });

  constructor() {
    effect(() => {
      const active = this.activeMembers();
      const current = this.filterMemberId();
      if (active.length > 0 && (current === null || !active.find((m) => m.id === current))) {
        this.filterMemberId.set(active[0].id);
      }
    });
  }

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

  private readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string | null }>();
    for (const m of this.members()) {
      map.set(m.id, { name: `${m.firstName} ${m.lastName}`, color: m.color });
    }
    return map;
  });

  protected memberName(id: string | null): string | null {
    if (!id) return null;
    return this.memberMap().get(id)?.name ?? null;
  }

  protected memberColor(id: string | null): string | null {
    if (!id) return null;
    return this.memberMap().get(id)?.color ?? null;
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
      this.toaster.success(data.direction === 'lent' ? 'Pret cree' : 'Emprunt cree');
    } catch {
      this.toaster.error('Erreur lors de la creation');
    }
  }

  protected async updateLoan(data: Omit<Loan, 'id'>) {
    const id = this.selectedLoan()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updateLoanUC.execute(id, data));
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success('Pret modifie');
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected async recordPayment(event: { amount: number; date: string; accountId: string | null }) {
    const loan = this.selectedLoan();
    if (!loan) return;
    try {
      await lastValueFrom(this.recordPaymentUC.execute(loan.id, event.amount, event.date));
      this.paymentModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success('Remboursement enregistre');

      if (event.accountId) {
        const direction = loan.direction === 'borrowed' ? 'Remb. dette' : 'Remb. pret';
        await lastValueFrom(
          this.createEntryUC.execute({
            label: `${direction} — ${loan.person}`,
            amount: event.amount,
            type: 'spending',
            accountId: event.accountId,
            memberId: loan.memberId,
            dayOfMonth: null,
            date: event.date || null,
            category: 'Remboursement',
            payslipKey: null,
          }),
        );
      }
    } catch {
      this.toaster.error('Erreur lors du remboursement');
    }
  }

  protected async deleteLoan(id: string) {
    if (!(await this.confirm.delete('ce pret'))) return;
    try {
      await lastValueFrom(this.deleteLoanUC.execute(id));
      this._refresh.update((v) => v + 1);
      this.toaster.success('Pret supprime');
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }

  protected async updateMemberColor(memberId: string, event: Event) {
    const color = (event.target as HTMLInputElement).value;
    await lastValueFrom(this.updateMemberColorUC.execute(memberId, color));
    this._refresh.update((v) => v + 1);
  }
}
