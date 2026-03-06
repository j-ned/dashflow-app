import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { Loan } from '../../domain/models/loan.model';
import { GetLoansUseCase } from '../../domain/use-cases/get-loans.use-case';
import { CreateLoanUseCase } from '../../domain/use-cases/create-loan.use-case';
import { UpdateLoanUseCase } from '../../domain/use-cases/update-loan.use-case';
import { RecordLoanPaymentUseCase } from '../../domain/use-cases/record-loan-payment.use-case';
import { DeleteLoanUseCase } from '../../domain/use-cases/delete-loan.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { LoanForm } from '../../components/loan-form/loan-form';
import { RecordPaymentForm } from '../../components/record-payment-form/record-payment-form';

@Component({
  selector: 'app-loans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, ModalDialog, LoanForm, RecordPaymentForm],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Prêts & Dettes</h2>
        <p class="mt-1 text-sm text-text-muted">Suivez vos prêts familiaux et dettes</p>
      </div>
      <div class="flex gap-2">
        <button type="button"
                class="rounded-lg bg-ib-blue px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-blue/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                (click)="openLentModal()">
          + Prêter
        </button>
        <button type="button"
                class="rounded-lg bg-ib-orange px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-orange/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-orange"
                (click)="openBorrowedModal()">
          + Emprunter
        </button>
      </div>
    </header>

    <section aria-labelledby="lent-heading">
      <h3 id="lent-heading" class="text-lg font-semibold text-ib-blue mb-3">Prêtés</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (loan of lentLoans(); track loan.id) {
          @let repaid = loan.amount - loan.remaining;
          @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
          <article class="rounded-xl border border-border bg-surface p-4 hover:border-ib-blue/30 transition-colors">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="font-semibold text-text-primary">{{ loan.person }}</p>
                @if (loan.description) {
                  <p class="text-xs text-text-muted mt-0.5">{{ loan.description }}</p>
                }
              </div>
              <span class="text-lg font-mono font-semibold text-ib-blue">{{ loan.remaining | number:'1.2-2' }} &euro;</span>
            </div>

            <dl class="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <dt class="text-text-muted/70">Montant prêté</dt>
                <dd class="font-mono text-text-primary">{{ loan.amount | number:'1.2-2' }} &euro;</dd>
              </div>
              <div>
                <dt class="text-text-muted/70">Remboursé</dt>
                <dd class="font-mono text-ib-green">{{ repaid | number:'1.2-2' }} &euro;</dd>
              </div>
              <div>
                <dt class="text-text-muted/70">Restant dû</dt>
                <dd class="font-mono text-ib-blue">{{ loan.remaining | number:'1.2-2' }} &euro;</dd>
              </div>
            </dl>

            @if (loan.date || loan.dueDate) {
              <dl class="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <dt class="text-text-muted/70">Date du prêt</dt>
                  <dd class="text-text-primary">{{ loan.date }}</dd>
                </div>
                @if (loan.dueDate) {
                  <div>
                    <dt class="text-text-muted/70">Échéance</dt>
                    <dd class="text-text-primary">{{ loan.dueDate }}</dd>
                  </div>
                }
              </dl>
            }

            <div class="flex justify-between text-xs text-text-muted mb-1">
              <span>Remboursément</span>
              <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-hover">
              <div class="h-full rounded-full bg-ib-blue transition-all duration-300"
                   [style.width.%]="pct > 100 ? 100 : pct"></div>
            </div>

            <div class="mt-3 flex gap-2 pt-3 border-t border-border/50">
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                      (click)="openPaymentModal(loan)">
                Remboursément
              </button>
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                      (click)="openEditModal(loan)">
                Modifier
              </button>
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                      (click)="deleteLoan(loan.id)">
                Supprimer
              </button>
            </div>
          </article>
        } @empty {
          <p class="col-span-full text-text-muted">Aucun prêt en cours</p>
        }
      </div>
    </section>

    <section aria-labelledby="borrowed-heading">
      <h3 id="borrowed-heading" class="text-lg font-semibold text-ib-red mb-3">Empruntés</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        @for (loan of borrowedLoans(); track loan.id) {
          @let repaid = loan.amount - loan.remaining;
          @let pct = loan.amount > 0 ? (repaid / loan.amount) * 100 : 0;
          <article class="rounded-xl border border-border bg-surface p-4 hover:border-ib-orange/30 transition-colors">
            <div class="flex items-start justify-between mb-2">
              <div>
                <p class="font-semibold text-text-primary">{{ loan.person }}</p>
                @if (loan.description) {
                  <p class="text-xs text-text-muted mt-0.5">{{ loan.description }}</p>
                }
              </div>
              <span class="text-lg font-mono font-semibold text-ib-red">{{ loan.remaining | number:'1.2-2' }} &euro;</span>
            </div>

            <dl class="grid grid-cols-3 gap-2 text-xs mb-3">
              <div>
                <dt class="text-text-muted/70">Montant emprunté</dt>
                <dd class="font-mono text-text-primary">{{ loan.amount | number:'1.2-2' }} &euro;</dd>
              </div>
              <div>
                <dt class="text-text-muted/70">Remboursé</dt>
                <dd class="font-mono text-ib-green">{{ repaid | number:'1.2-2' }} &euro;</dd>
              </div>
              <div>
                <dt class="text-text-muted/70">Restant dû</dt>
                <dd class="font-mono text-ib-red">{{ loan.remaining | number:'1.2-2' }} &euro;</dd>
              </div>
            </dl>

            @if (loan.date || loan.dueDate) {
              <dl class="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <dt class="text-text-muted/70">Date de l'emprunt</dt>
                  <dd class="text-text-primary">{{ loan.date }}</dd>
                </div>
                @if (loan.dueDate) {
                  <div>
                    <dt class="text-text-muted/70">Échéance</dt>
                    <dd class="text-text-primary">{{ loan.dueDate }}</dd>
                  </div>
                }
              </dl>
            }

            <div class="flex justify-between text-xs text-text-muted mb-1">
              <span>Remboursément</span>
              <span class="font-mono">{{ pct | number:'1.0-0' }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-hover">
              <div class="h-full rounded-full bg-ib-orange transition-all duration-300"
                   [style.width.%]="pct > 100 ? 100 : pct"></div>
            </div>

            <div class="mt-3 flex gap-2 pt-3 border-t border-border/50">
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
                      (click)="openPaymentModal(loan)">
                Remboursément
              </button>
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-yellow"
                      (click)="openEditModal(loan)">
                Modifier
              </button>
              <button type="button"
                      class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
                      (click)="deleteLoan(loan.id)">
                Supprimer
              </button>
            </div>
          </article>
        } @empty {
          <p class="col-span-full text-text-muted">Aucune dette en cours</p>
        }
      </div>
    </section>

    <app-modal-dialog #lentModal title="Nouveau prêt" (closed)="onModalClosed()">
      <app-loan-form direction="lent" (submitted)="createLoan($event)" (cancelled)="lentModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #borrowedModal title="Nouvel emprunt" (closed)="onModalClosed()">
      <app-loan-form direction="borrowed" (submitted)="createLoan($event)" (cancelled)="borrowedModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier" (closed)="onModalClosed()">
      <app-loan-form [direction]="selectedLoan()?.direction ?? 'lent'" [initial]="selectedLoan()" (submitted)="updateLoan($event)" (cancelled)="editModal.close()" />
    </app-modal-dialog>

    <app-modal-dialog #paymentModal title="Remboursément" (closed)="onModalClosed()">
      <app-record-payment-form (submitted)="recordPayment($event)" (cancelled)="paymentModal.close()" />
    </app-modal-dialog>
  `,
})
export class Loans {
  private readonly getLoans = inject(GetLoansUseCase);
  private readonly createLoanUC = inject(CreateLoanUseCase);
  private readonly updateLoanUC = inject(UpdateLoanUseCase);
  private readonly recordPaymentUC = inject(RecordLoanPaymentUseCase);
  private readonly deleteLoanUC = inject(DeleteLoanUseCase);

  private readonly lentModalRef = viewChild.required<ModalDialog>('lentModal');
  private readonly borrowedModalRef = viewChild.required<ModalDialog>('borrowedModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly paymentModalRef = viewChild.required<ModalDialog>('paymentModal');

  private readonly _refresh = signal(0);
  protected readonly loans = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getLoans.execute())),
    { initialValue: [] },
  );

  protected readonly lentLoans = computed(() =>
    this.loans().filter(l => l.direction === 'lent')
  );

  protected readonly borrowedLoans = computed(() =>
    this.loans().filter(l => l.direction === 'borrowed')
  );

  protected readonly selectedLoan = signal<Loan | null>(null);

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

  protected onModalClosed() {
    this.selectedLoan.set(null);
  }

  protected createLoan(data: Omit<Loan, 'id'>) {
    this.createLoanUC.execute(data).subscribe(() => {
      if (data.direction === 'lent') {
        this.lentModalRef().close();
      } else {
        this.borrowedModalRef().close();
      }
      this._refresh.update(v => v + 1);
    });
  }

  protected updateLoan(data: Omit<Loan, 'id'>) {
    const id = this.selectedLoan()?.id;
    if (!id) return;
    this.updateLoanUC.execute(id, data).subscribe(() => {
      this.editModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected recordPayment(event: { amount: number }) {
    const id = this.selectedLoan()?.id;
    if (!id) return;
    this.recordPaymentUC.execute(id, event.amount).subscribe(() => {
      this.paymentModalRef().close();
      this._refresh.update(v => v + 1);
    });
  }

  protected deleteLoan(id: string) {
    if (!confirm('Supprimer ce prêt ?')) return;
    this.deleteLoanUC.execute(id).subscribe(() => {
      this._refresh.update(v => v + 1);
    });
  }
}
