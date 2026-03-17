import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal, viewChild } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { Envelope } from '../../domain/models/envelope.model';
import { EnvelopeTransaction } from '../../domain/models/envelope-transaction.model';
import { GetEnvelopesUseCase } from '../../domain/use-cases/get-envelopes.use-case';
import { CreateEnvelopeUseCase } from '../../domain/use-cases/create-envelope.use-case';
import { UpdateEnvelopeUseCase } from '../../domain/use-cases/update-envelope.use-case';
import { CreditEnvelopeUseCase } from '../../domain/use-cases/credit-envelope.use-case';
import { DeleteEnvelopeUseCase } from '../../domain/use-cases/delete-envelope.use-case';
import { GetEnvelopeTransactionsUseCase } from '../../domain/use-cases/get-envelope-transactions.use-case';
import { AddEnvelopeTransactionUseCase } from '../../domain/use-cases/add-envelope-transaction.use-case';
import { GetMembersUseCase } from '../../domain/use-cases/get-members.use-case';
import { GetBankAccountsUseCase } from '../../domain/use-cases/get-bank-accounts.use-case';
import { CreateRecurringEntryUseCase } from '../../domain/use-cases/create-recurring-entry.use-case';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { EnvelopeForm } from '../../components/envelope-form/envelope-form';
import { CreditEnvelopeForm } from '../../components/credit-envelope-form/credit-envelope-form';
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
  selector: 'app-envelopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    ModalDialog,
    EnvelopeForm,
    CreditEnvelopeForm,
    Icon,
    FormsModule,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">Enveloppes</h2>
        <p class="mt-1 text-sm text-text-muted">Gérez vos enveloppes virtuelles</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-green px-4 py-2 text-sm font-medium text-white hover:bg-ib-green/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> Nouvelle enveloppe
      </button>
    </header>

    <!-- Member filter -->
    @if (activeMembers().length > 0) {
      <div class="flex gap-2 flex-wrap items-center">
        @for (m of activeMembers(); track m.id; let i = $index) {
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
            [style.border-color]="filterMemberId() === m.id ? memberMap().get(m.id)?.color : 'var(--border)'"
            [style.background-color]="filterMemberId() === m.id ? memberMap().get(m.id)?.color : 'transparent'"
            [class.text-white]="filterMemberId() === m.id"
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

    <section
      aria-label="Liste des enveloppes"
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      @for (envelope of filteredEnvelopes(); track envelope.id) {
        <article
          class="group relative overflow-hidden rounded-xl border border-border bg-surface transition-all hover:border-ib-cyan/30 hover:shadow-lg hover:shadow-ib-cyan/5"
        >
          <div
            class="absolute inset-y-0 left-0 w-1 rounded-l-xl"
            [style.background-color]="envelope.color"
          ></div>
          <div class="p-5">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-ib-cyan/10">
                  <app-icon name="wallet" size="16" class="text-ib-cyan" />
                </div>
                <h3 class="font-semibold text-text-primary">{{ envelope.name }}</h3>
              </div>
              <span
                class="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                [style.background-color]="envelope.color + '20'"
                [style.color]="envelope.color"
              >
                {{ envelope.type }}
              </span>
            </div>

            <div class="flex items-center gap-2 text-[11px] text-text-muted mb-3 ml-10">
              @if (memberMap().get(envelope.memberId ?? ''); as member) {
                <span class="inline-flex items-center gap-1">
                  <span
                    class="inline-block h-2 w-2 rounded-full"
                    [style.background-color]="member.color"
                  ></span>
                  {{ member.name }}
                </span>
              }
              @if (envelope.dueDay) {
                <span class="rounded-md bg-raised px-1.5 py-0.5 font-mono text-[10px]"
                  >le {{ envelope.dueDay }}</span
                >
              }
            </div>

            <p class="text-2xl font-mono font-bold text-ib-cyan tracking-tight ml-10">
              {{ envelope.balance | number: '1.2-2' }}<span class="text-base ml-0.5">&euro;</span>
            </p>

            @if (envelope.target) {
              @let pct = (envelope.balance / envelope.target) * 100;
              @let remaining = envelope.target - envelope.balance;
              <div class="mt-3 ml-10">
                <div class="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div>
                    <p class="text-[10px] text-text-muted">Objectif</p>
                    <p class="font-mono font-medium text-text-primary">
                      {{ envelope.target | number: '1.2-2' }}&euro;
                    </p>
                  </div>
                  <div>
                    <p class="text-[10px] text-text-muted">Restant</p>
                    <p
                      class="font-mono font-medium"
                      [class.text-ib-green]="remaining <= 0"
                      [class.text-ib-yellow]="remaining > 0"
                    >
                      {{ remaining > 0 ? (remaining | number: '1.2-2') : '0,00' }}&euro;
                    </p>
                  </div>
                </div>
                <div class="flex justify-between text-[10px] text-text-muted mb-1">
                  <span>Progression</span>
                  <span class="font-mono font-semibold">{{ pct | number: '1.0-0' }}%</span>
                </div>
                <div class="h-2 rounded-full bg-hover overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500 ease-out"
                    [style.width.%]="pct > 100 ? 100 : pct"
                    [style.background-color]="envelope.color"
                  ></div>
                </div>
              </div>
            } @else {
              <p class="text-[11px] text-text-muted mt-2 ml-10">Aucun objectif défini</p>
            }
          </div>

          <div
            class="flex items-center justify-end gap-1 px-4 py-2.5 border-t border-border/50 bg-canvas/50"
          >
            <button
              type="button"
              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors"
              (click)="openCreditModal(envelope)"
              aria-label="Créditer/Débiter"
            >
              <app-icon name="plus-circle" size="14" />
            </button>
            <button
              type="button"
              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
              (click)="openHistoryModal(envelope)"
              aria-label="Historique"
            >
              <app-icon name="clock" size="14" />
            </button>
            <button
              type="button"
              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors"
              (click)="openEditModal(envelope)"
              aria-label="Modifier"
            >
              <app-icon name="pencil" size="14" />
            </button>
            <button
              type="button"
              class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
              (click)="deleteEnvelope(envelope.id)"
              aria-label="Supprimer"
            >
              <app-icon name="trash" size="14" />
            </button>
          </div>
        </article>
      } @empty {
        <div
          class="col-span-full text-center py-16 rounded-xl border border-dashed border-border bg-surface"
        >
          <app-icon name="wallet" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">Aucune enveloppe</p>
          <p class="text-xs text-text-muted mt-1">Créez votre première enveloppe</p>
        </div>
      }
    </section>

    <footer class="rounded-xl border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-ib-cyan/5">
        <div class="flex items-center gap-2">
          <app-icon name="wallet" size="16" class="text-ib-cyan" />
          <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-cyan"
            >Total toutes enveloppes</span
          >
        </div>
        <span class="text-xl font-mono font-bold text-ib-cyan"
          >{{ totalBalance() | number: '1.2-2' }}<span class="text-base ml-0.5">&euro;</span></span
        >
      </div>
    </footer>

    <app-modal-dialog #createModal title="Nouvelle enveloppe" (closed)="onModalClosed()">
      @if (createModal.isOpen()) {
        <app-envelope-form
          [members]="members()"
          (submitted)="createEnvelope($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog #editModal title="Modifier l'enveloppe" (closed)="onModalClosed()">
      @if (editModal.isOpen()) {
        <app-envelope-form
          [initial]="selectedEnvelope()"
          [members]="members()"
          (submitted)="updateEnvelope($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog #creditModal title="Créditer / Débiter" (closed)="onModalClosed()">
      @if (creditModal.isOpen()) {
        <app-credit-envelope-form
          [accounts]="accounts()"
          (submitted)="creditEnvelope($event)"
          (cancelled)="creditModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #historyModal
      [title]="'Historique — ' + (selectedEnvelope()?.name ?? '')"
      (closed)="onModalClosed()"
    >
      @if (historyModal.isOpen()) {
      <div class="space-y-4">
        <form class="flex gap-2 items-end" (ngSubmit)="addManualTransaction()">
          <div class="flex-1">
            <label for="env-tx-amount" class="text-xs text-text-muted">Montant</label>
            <input
              id="env-tx-amount"
              type="number"
              step="0.01"
              class="form-input mono"
              [value]="manualTxAmount()"
              (input)="manualTxAmount.set(+$any($event.target).value)"
            />
            <p class="text-[10px] mt-0.5" style="color: var(--color-text-muted)">
              Positif = crédit, négatif = débit
            </p>
          </div>
          <div class="flex-1">
            <label for="env-tx-date" class="text-xs text-text-muted">Date</label>
            <input
              id="env-tx-date"
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
                    <td
                      class="px-4 py-2.5 text-right font-mono font-medium"
                      [class.text-ib-green]="tx.amount > 0"
                      [class.text-ib-red]="tx.amount < 0"
                    >
                      {{ tx.amount > 0 ? '+' : '' }}{{ tx.amount | number: '1.2-2' }}&euro;
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="text-center py-8">
            <app-icon name="clock" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">Aucune opération enregistrée</p>
          </div>
        }
      </div>
      }
    </app-modal-dialog>
  `,
})
export class Envelopes {
  private readonly getEnvelopes = inject(GetEnvelopesUseCase);
  private readonly createEnvelopeUC = inject(CreateEnvelopeUseCase);
  private readonly updateEnvelopeUC = inject(UpdateEnvelopeUseCase);
  private readonly creditEnvelopeUC = inject(CreditEnvelopeUseCase);
  private readonly deleteEnvelopeUC = inject(DeleteEnvelopeUseCase);
  private readonly getTransactionsUC = inject(GetEnvelopeTransactionsUseCase);
  private readonly addTransactionUC = inject(AddEnvelopeTransactionUseCase);
  private readonly getMembersUC = inject(GetMembersUseCase);
  private readonly getAccountsUC = inject(GetBankAccountsUseCase);
  private readonly createEntryUC = inject(CreateRecurringEntryUseCase);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly creditModalRef = viewChild.required<ModalDialog>('creditModal');
  private readonly historyModalRef = viewChild.required<ModalDialog>('historyModal');

  private readonly _refresh = signal(0);
  protected readonly envelopes = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.getEnvelopes.execute())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.getMembersUC.execute(), { initialValue: [] });
  protected readonly accounts = toSignal(this.getAccountsUC.execute(), { initialValue: [] });
  protected readonly activeMembers = computed(() => {
    const envs = this.envelopes();
    const memberIds = new Set(envs.map((e) => e.memberId).filter(Boolean));
    return this.members().filter((m) => memberIds.has(m.id));
  });

  protected readonly filterMemberId = linkedSignal<string | null>(() => {
    const active = this.activeMembers();
    return active.length > 0 ? active[0].id : null;
  });

  protected readonly filteredEnvelopes = computed(() => {
    const all = this.envelopes();
    const fid = this.filterMemberId();
    if (!fid) return all;
    return all.filter((e) => e.memberId === fid);
  });

  protected readonly totalBalance = computed(() =>
    this.filteredEnvelopes().reduce((sum, e) => sum + e.balance, 0),
  );

  protected readonly selectedEnvelope = signal<Envelope | null>(null);
  protected readonly transactions = signal<EnvelopeTransaction[]>([]);
  protected readonly manualTxAmount = signal(0);
  protected readonly manualTxDate = signal(new Date().toISOString().slice(0, 10));

  protected readonly memberMap = computed(() => {
    const map = new Map<string, { name: string; color: string }>();
    const mbrs = this.members();
    for (let i = 0; i < mbrs.length; i++) {
      const m = mbrs[i];
      map.set(m.id, { name: `${m.firstName} ${m.lastName}`, color: MEMBER_PALETTE[i % MEMBER_PALETTE.length] });
    }
    return map;
  });

  protected openCreateModal() {
    this.createModalRef().open();
  }

  protected openEditModal(envelope: Envelope) {
    this.selectedEnvelope.set(envelope);
    this.editModalRef().open();
  }

  protected openCreditModal(envelope: Envelope) {
    this.selectedEnvelope.set(envelope);
    this.creditModalRef().open();
  }

  protected async openHistoryModal(envelope: Envelope) {
    this.selectedEnvelope.set(envelope);
    const txs = await lastValueFrom(this.getTransactionsUC.execute(envelope.id));
    this.transactions.set(txs);
    this.historyModalRef().open();
  }

  protected async addManualTransaction() {
    const envelope = this.selectedEnvelope();
    const amount = this.manualTxAmount();
    const date = this.manualTxDate();
    if (!envelope || !amount || !date) return;
    const tx = await lastValueFrom(this.addTransactionUC.execute(envelope.id, { amount, date }));
    this.transactions.update((txs) => [tx, ...txs]);
    this.manualTxAmount.set(0);
    this.manualTxDate.set(new Date().toISOString().slice(0, 10));
  }

  protected onModalClosed() {
    this.selectedEnvelope.set(null);
    this.transactions.set([]);
    this.manualTxAmount.set(0);
    this.manualTxDate.set(new Date().toISOString().slice(0, 10));
  }

  protected async createEnvelope(data: Omit<Envelope, 'id'>) {
    try {
      await lastValueFrom(this.createEnvelopeUC.execute(data));
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success('Enveloppe créée');
    } catch {
      this.toaster.error('Erreur lors de la création');
    }
  }

  protected async updateEnvelope(data: Omit<Envelope, 'id'>) {
    const id = this.selectedEnvelope()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.updateEnvelopeUC.execute(id, data));
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success('Enveloppe modifiée');
    } catch {
      this.toaster.error('Erreur lors de la modification');
    }
  }

  protected async creditEnvelope(event: { amount: number; date: string; accountId: string | null }) {
    const envelope = this.selectedEnvelope();
    if (!envelope) return;
    try {
      await lastValueFrom(this.creditEnvelopeUC.execute(envelope.id, event.amount, event.date));
      this.creditModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(event.amount > 0 ? 'Enveloppe créditée' : 'Enveloppe débitée');
      if (event.accountId && event.amount > 0) {
        await lastValueFrom(
          this.createEntryUC.execute({
            label: `Crédit enveloppe — ${envelope.name}`,
            amount: event.amount,
            type: 'spending',
            accountId: event.accountId,
            memberId: envelope.memberId,
            dayOfMonth: null,
            date: event.date || null,
            category: 'Enveloppe',
            payslipKey: null,
          }),
        );
      }
    } catch {
      this.toaster.error("Erreur lors de l'operation");
    }
  }

  protected async deleteEnvelope(id: string) {
    if (!(await this.confirm.delete('cette enveloppe'))) return;
    try {
      await lastValueFrom(this.deleteEnvelopeUC.execute(id));
      this._refresh.update((v) => v + 1);
      this.toaster.success('Enveloppe supprimée');
    } catch {
      this.toaster.error('Erreur lors de la suppression');
    }
  }

}
