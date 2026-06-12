import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Envelope } from '../../domain/models/envelope.model';
import { buildMemberMap } from '../../domain/member-map';
import { activeMembers as activeMembersOf } from '../../domain/active-members';
import { buildEnvelopeHistories, HistoryEntry } from '../../domain/envelope-history';
import { buildEnvelopeCreditEntry } from '../../domain/envelope-credit-entry';
import { EnvelopeCard } from '../../components/envelope-card/envelope-card';
import { EnvelopeHistoryList } from '../../components/envelope-history-list/envelope-history-list';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { MemberGateway } from '@features/budget/domain/gateways/member.gateway';
import { BankAccountGateway } from '@features/budget/domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '@features/budget/domain/gateways/recurring-entry.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { EnvelopeForm } from '../../components/envelope-form/envelope-form';
import { CreditEnvelopeForm } from '../../components/credit-envelope-form/credit-envelope-form';
import { MemberFilter } from '../../components/member-filter/member-filter';
import { Icon } from '@shared/components/icon/icon';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';
import { Toaster } from '@shared/components/toast/toast';

@Component({
  selector: 'app-envelopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DecimalPipe,
    ModalDialog,
    EnvelopeForm,
    CreditEnvelopeForm,
    MemberFilter,
    EnvelopeCard,
    EnvelopeHistoryList,
    Icon,
    TranslocoPipe,
  ],
  host: { class: 'block space-y-6' },
  template: `
    <header class="flex items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold text-text-primary">
          {{ 'budget.envelope.title' | transloco }}
        </h2>
        <p class="mt-1 text-sm text-text-muted">{{ 'budget.envelope.subtitle' | transloco }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-ib-green px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-green/90 transition-colors shadow-sm"
        (click)="openCreateModal()"
      >
        <app-icon name="plus" size="14" /> {{ 'budget.envelope.newEnvelope' | transloco }}
      </button>
    </header>

    @if (activeMembers().length > 0) {
      <app-member-filter
        [members]="activeMembers()"
        [memberMap]="memberMap()"
        labelKey="budget.envelope.filterLabel"
        allKey="budget.envelope.filterAll"
        [(selected)]="filterMemberId"
      />
    }

    <section
      [attr.aria-label]="'budget.envelope.listAria' | transloco"
      class="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      @for (envelope of filteredEnvelopes(); track envelope.id) {
        <app-envelope-card
          [envelope]="envelope"
          [entries]="recentByEnvelope().get(envelope.id) ?? []"
          [member]="memberMap().get(envelope.memberId ?? '') ?? null"
          (credit)="openCreditModal(envelope)"
          (edit)="openEditModal(envelope)"
          (remove)="deleteEnvelope(envelope.id)"
          (history)="openHistoryModal(envelope)"
        />
      } @empty {
        <div
          class="col-span-full text-center py-16 rounded-lg border border-dashed border-border bg-surface"
        >
          <app-icon name="wallet" size="48" class="text-text-muted/20 mx-auto mb-3" />
          <p class="text-sm text-text-muted">{{ 'budget.envelope.empty' | transloco }}</p>
          <p class="text-xs text-text-muted mt-1">{{ 'budget.envelope.emptyHint' | transloco }}</p>
        </div>
      }
    </section>

    <footer class="rounded-lg border border-border bg-surface overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 bg-ib-cyan/5">
        <div class="flex items-center gap-2">
          <app-icon name="wallet" size="16" class="text-ib-cyan" />
          <span class="text-[11px] font-semibold uppercase tracking-wider text-ib-cyan">{{
            'budget.envelope.totalAll' | transloco
          }}</span>
        </div>
        <span class="text-xl font-mono font-bold text-ib-cyan"
          >{{ totalBalance() | number: '1.2-2' }}<span class="text-base ml-0.5">&euro;</span></span
        >
      </div>
    </footer>

    <app-modal-dialog
      #createModal
      [title]="'budget.envelope.modal.create' | transloco"
      (closed)="onModalClosed()"
    >
      @if (createModal.isOpen()) {
        <app-envelope-form
          [members]="members()"
          (submitted)="createEnvelope($event)"
          (cancelled)="createModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #editModal
      [title]="'budget.envelope.modal.edit' | transloco"
      (closed)="onModalClosed()"
    >
      @if (editModal.isOpen()) {
        <app-envelope-form
          [initial]="selectedEnvelope()"
          [members]="members()"
          (submitted)="updateEnvelope($event)"
          (cancelled)="editModal.close()"
        />
      }
    </app-modal-dialog>

    <app-modal-dialog
      #creditModal
      [title]="'budget.envelope.modal.credit' | transloco"
      (closed)="onModalClosed()"
    >
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
      [title]="
        'budget.envelope.modal.history' | transloco: { name: selectedEnvelope()?.name ?? '' }
      "
      (closed)="onModalClosed()"
    >
      @if (historyModal.isOpen()) {
        <app-envelope-history-list [history]="selectedHistory()" />
      }
    </app-modal-dialog>
  `,
})
export class Envelopes {
  private readonly envelopeGateway = inject(EnvelopeGateway);
  private readonly memberGateway = inject(MemberGateway);
  private readonly bankAccountGateway = inject(BankAccountGateway);
  private readonly recurringEntryGateway = inject(RecurringEntryGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  private readonly createModalRef = viewChild.required<ModalDialog>('createModal');
  private readonly editModalRef = viewChild.required<ModalDialog>('editModal');
  private readonly creditModalRef = viewChild.required<ModalDialog>('creditModal');
  private readonly historyModalRef = viewChild.required<ModalDialog>('historyModal');

  private readonly _refresh = signal(0);
  protected readonly envelopes = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.envelopeGateway.getAll())),
    { initialValue: [] },
  );

  private readonly allTransactions = toSignal(
    toObservable(this._refresh).pipe(switchMap(() => this.envelopeGateway.getAllTransactions())),
    { initialValue: [] },
  );

  protected readonly members = toSignal(this.memberGateway.getAll(), { initialValue: [] });
  protected readonly accounts = toSignal(this.bankAccountGateway.getAll(), { initialValue: [] });
  protected readonly activeMembers = computed(() =>
    activeMembersOf(this.members(), this.envelopes()),
  );

  // Defaults to "Tous" (null) so nothing is hidden on first view.
  protected readonly filterMemberId = signal<string | null>(null);

  protected readonly filteredEnvelopes = computed(() => {
    const all = this.envelopes();
    const fid = this.filterMemberId();
    if (!fid) return all;
    return all.filter((e) => e.memberId === fid);
  });

  protected readonly totalBalance = computed(() =>
    this.filteredEnvelopes().reduce((sum, e) => sum + e.balance, 0),
  );

  protected readonly recentByEnvelope = computed(() =>
    buildEnvelopeHistories(this.envelopes(), this.allTransactions()),
  );

  protected readonly selectedEnvelope = signal<Envelope | null>(null);
  protected readonly selectedHistory = computed<HistoryEntry[]>(() => {
    const envelope = this.selectedEnvelope();
    return envelope ? (this.recentByEnvelope().get(envelope.id) ?? []) : [];
  });

  protected readonly memberMap = computed(() => buildMemberMap(this.members()));

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

  protected openHistoryModal(envelope: Envelope) {
    this.selectedEnvelope.set(envelope);
    this.historyModalRef().open();
  }

  protected onModalClosed() {
    this.selectedEnvelope.set(null);
  }

  protected async createEnvelope(data: Omit<Envelope, 'id'>) {
    try {
      await lastValueFrom(this.envelopeGateway.create(data));
      this.createModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success('budget.envelope.messages.created');
    } catch {
      this.toaster.error('budget.envelope.messages.createError');
    }
  }

  protected async updateEnvelope(data: Omit<Envelope, 'id'>) {
    const id = this.selectedEnvelope()?.id;
    if (!id) return;
    try {
      await lastValueFrom(this.envelopeGateway.update(id, data));
      this.editModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success('budget.envelope.messages.updated');
    } catch {
      this.toaster.error('budget.envelope.messages.updateError');
    }
  }

  protected async creditEnvelope(event: {
    amount: number;
    date: string;
    note: string | null;
    accountId: string | null;
  }) {
    const envelope = this.selectedEnvelope();
    if (!envelope) return;
    try {
      await lastValueFrom(
        this.envelopeGateway.updateBalance(
          envelope.id,
          event.amount,
          event.date,
          event.note,
          envelope,
        ),
      );
      this.creditModalRef().close();
      this._refresh.update((v) => v + 1);
      this.toaster.success(
        event.amount >= 0
          ? 'budget.envelope.messages.credited'
          : 'budget.envelope.messages.debited',
      );
      if (event.accountId && event.amount > 0) {
        await lastValueFrom(
          this.recurringEntryGateway.create(
            buildEnvelopeCreditEntry(envelope, event, {
              label: this._i18n.translate('budget.envelope.messages.envelopeCreditLabel', {
                name: envelope.name,
              }),
              category: this._i18n.translate('budget.envelope.messages.envelopeCreditCategory'),
            }),
          ),
        );
      }
    } catch {
      this.toaster.error('budget.envelope.messages.creditError');
    }
  }

  protected async deleteEnvelope(id: string) {
    if (!(await this.confirm.delete(this._i18n.translate('budget.envelope.messages.deleteTarget'))))
      return;
    try {
      await lastValueFrom(this.envelopeGateway.delete(id));
      this._refresh.update((v) => v + 1);
      this.toaster.success('budget.envelope.messages.deleted');
    } catch {
      this.toaster.error('budget.envelope.messages.deleteError');
    }
  }
}
