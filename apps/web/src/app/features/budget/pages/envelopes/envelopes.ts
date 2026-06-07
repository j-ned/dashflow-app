import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { lastValueFrom, switchMap } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Envelope } from '../../domain/models/envelope.model';
import { EnvelopeTransaction } from '../../domain/models/envelope-transaction.model';
import { buildMemberMap } from '../../domain/member-map';
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

type HistoryEntry = { readonly tx: EnvelopeTransaction; readonly balanceAfter: number };

@Component({
  selector: 'app-envelopes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    DecimalPipe,
    ModalDialog,
    EnvelopeForm,
    CreditEnvelopeForm,
    MemberFilter,
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
        @let entries = recentByEnvelope().get(envelope.id) ?? [];
        <article
          class="flex flex-col rounded-lg border border-border bg-surface transition hover:border-border/80"
        >
          <div class="p-5">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                <span
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  [style.background-color]="envelope.color + '1a'"
                >
                  <app-icon name="wallet" size="18" [style.color]="envelope.color" />
                </span>
                <div class="min-w-0">
                  <h3 class="truncate font-semibold text-text-primary">{{ envelope.name }}</h3>
                  <p
                    class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-muted"
                  >
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
                      <span>{{
                        'budget.envelope.dueDayLabel' | transloco: { day: envelope.dueDay }
                      }}</span>
                    }
                  </p>
                </div>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                [style.background-color]="envelope.color + '1a'"
                [style.color]="envelope.color"
                >{{ envelope.type }}</span
              >
            </div>

            <p class="mt-4 font-mono text-3xl font-bold tracking-tight text-text-primary">
              {{ envelope.balance | number: '1.2-2'
              }}<span class="ml-1 text-lg text-text-muted">&euro;</span>
            </p>

            @if (envelope.target) {
              @let pct = (envelope.balance / envelope.target) * 100;
              @let remaining = envelope.target - envelope.balance;
              <div class="mt-3">
                <div class="h-2 overflow-hidden rounded-full bg-hover">
                  <div
                    class="h-full rounded-full"
                    [style.width.%]="pct > 100 ? 100 : pct"
                    [style.background-color]="envelope.color"
                  ></div>
                </div>
                <div class="mt-1.5 flex items-center justify-between text-xs">
                  <span class="text-text-muted">
                    {{ 'budget.envelope.objective' | transloco }}
                    <span class="font-mono text-text-primary"
                      >{{ envelope.target | number: '1.0-0' }}&euro;</span
                    >
                  </span>
                  <span
                    class="font-mono font-semibold"
                    [class.text-ib-green]="remaining <= 0"
                    [class.text-text-muted]="remaining > 0"
                  >
                    {{
                      remaining > 0
                        ? ('budget.envelope.remainingShort'
                          | transloco: { amount: (remaining | number: '1.0-0') })
                        : ('budget.envelope.reached' | transloco)
                    }}
                    · {{ pct | number: '1.0-0' }}%
                  </span>
                </div>
              </div>
            } @else {
              <p class="mt-2 text-xs text-text-muted">
                {{ 'budget.envelope.noObjective' | transloco }}
              </p>
            }

            <div class="mt-4 border-t border-border/60 pt-3">
              <div class="mb-2 flex items-center justify-between">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{{
                  'budget.envelope.recentActivity' | transloco
                }}</span>
                @if (entries.length > 0) {
                  <button
                    type="button"
                    class="text-[11px] font-medium text-ib-cyan hover:underline"
                    (click)="openHistoryModal(envelope)"
                  >
                    {{ 'budget.envelope.viewAll' | transloco }}
                  </button>
                }
              </div>
              @if (entries.length > 0) {
                <ul class="space-y-1.5">
                  @for (entry of entries.slice(0, 3); track entry.tx.id) {
                    <li class="flex items-center justify-between gap-2 text-xs">
                      <span class="flex min-w-0 items-center gap-1.5">
                        <app-icon
                          [name]="entry.tx.amount >= 0 ? 'arrow-up-right' : 'arrow-down-left'"
                          size="12"
                          [class.text-ib-green]="entry.tx.amount >= 0"
                          [class.text-ib-red]="entry.tx.amount < 0"
                        />
                        <span class="truncate text-text-muted">{{
                          entry.tx.note || (entry.tx.date | date: 'dd/MM/yy')
                        }}</span>
                      </span>
                      <span
                        class="shrink-0 font-mono"
                        [class.text-ib-green]="entry.tx.amount >= 0"
                        [class.text-ib-red]="entry.tx.amount < 0"
                      >
                        {{ entry.tx.amount >= 0 ? '+' : ''
                        }}{{ entry.tx.amount | number: '1.2-2' }}&euro;
                      </span>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-xs text-text-muted">
                  {{ 'budget.envelope.noActivity' | transloco }}
                </p>
              }
            </div>
          </div>

          <div
            class="mt-auto flex flex-wrap items-center gap-2 border-t border-border/60 px-5 py-3"
          >
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-ib-cyan/10 px-3 py-2 text-xs font-semibold text-ib-cyan transition-colors hover:bg-ib-cyan/20"
              (click)="openCreditModal(envelope)"
            >
              <app-icon name="plus" size="14" /> {{ 'budget.envelope.creditAction' | transloco }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
              [attr.aria-label]="'budget.envelope.editAria' | transloco: { name: envelope.name }"
              (click)="openEditModal(envelope)"
            >
              <app-icon name="pencil" size="14" /> {{ 'budget.envelope.editAction' | transloco }}
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-text-muted transition-colors hover:border-ib-red/40 hover:bg-ib-red/10 hover:text-ib-red"
              [attr.aria-label]="'budget.envelope.deleteAria' | transloco: { name: envelope.name }"
              (click)="deleteEnvelope(envelope.id)"
            >
              <app-icon name="trash" size="14" /> {{ 'budget.envelope.deleteAction' | transloco }}
            </button>
          </div>
        </article>
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
        @let history = selectedHistory();
        @if (history.length > 0) {
          <ul class="divide-y divide-border/40 rounded-lg border border-border overflow-hidden">
            @for (entry of history; track entry.tx.id) {
              <li class="flex items-center justify-between gap-3 px-4 py-3">
                <div class="flex min-w-0 items-center gap-3">
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    [class.bg-ib-green]="entry.tx.amount >= 0"
                    [class.bg-ib-red]="entry.tx.amount < 0"
                    [style.background-color]="
                      entry.tx.amount >= 0
                        ? 'color-mix(in srgb, var(--color-ib-green) 12%, transparent)'
                        : 'color-mix(in srgb, var(--color-ib-red) 12%, transparent)'
                    "
                  >
                    <app-icon
                      [name]="entry.tx.amount >= 0 ? 'arrow-up-right' : 'arrow-down-left'"
                      size="14"
                      [class.text-ib-green]="entry.tx.amount >= 0"
                      [class.text-ib-red]="entry.tx.amount < 0"
                    />
                  </span>
                  <div class="min-w-0">
                    <p
                      class="font-mono text-sm font-medium"
                      [class.text-ib-green]="entry.tx.amount >= 0"
                      [class.text-ib-red]="entry.tx.amount < 0"
                    >
                      {{ entry.tx.amount >= 0 ? '+' : ''
                      }}{{ entry.tx.amount | number: '1.2-2' }}&euro;
                    </p>
                    @if (entry.tx.note) {
                      <p class="truncate text-xs text-text-muted">{{ entry.tx.note }}</p>
                    }
                  </div>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-xs text-text-muted">{{ entry.tx.date | date: 'dd/MM/yyyy' }}</p>
                  <p class="font-mono text-xs text-text-muted">
                    {{ 'budget.envelope.balanceAfter' | transloco }}
                    {{ entry.balanceAfter | number: '1.2-2' }}&euro;
                  </p>
                </div>
              </li>
            }
          </ul>
        } @else {
          <div class="text-center py-8">
            <app-icon name="clock" size="32" class="text-text-muted/20 mx-auto mb-2" />
            <p class="text-sm text-text-muted">
              {{ 'budget.envelope.modal.noTransactions' | transloco }}
            </p>
            <p class="text-xs text-text-muted mt-1">
              {{ 'budget.envelope.modal.historyHint' | transloco }}
            </p>
          </div>
        }
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
  protected readonly activeMembers = computed(() => {
    const envs = this.envelopes();
    const memberIds = new Set(envs.map((e) => e.memberId).filter(Boolean));
    return this.members().filter((m) => memberIds.has(m.id));
  });

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

  // Real deposit history per envelope, with the running balance after each operation.
  // Zero-amount rows (legacy E2EE balance snapshots) are filtered out.
  protected readonly recentByEnvelope = computed(() => {
    const byEnvelope = new Map<string, EnvelopeTransaction[]>();
    for (const tx of this.allTransactions()) {
      if (Number(tx.amount) === 0) continue;
      const list = byEnvelope.get(tx.envelopeId);
      if (list) list.push(tx);
      else byEnvelope.set(tx.envelopeId, [tx]);
    }
    const result = new Map<string, HistoryEntry[]>();
    for (const envelope of this.envelopes()) {
      const txs = (byEnvelope.get(envelope.id) ?? [])
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date));
      let balance = Number(envelope.balance);
      const entries: HistoryEntry[] = txs.map((tx) => {
        const entry: HistoryEntry = { tx, balanceAfter: balance };
        balance -= Number(tx.amount);
        return entry;
      });
      result.set(envelope.id, entries);
    }
    return result;
  });

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
          this.recurringEntryGateway.create({
            label: this._i18n.translate('budget.envelope.messages.envelopeCreditLabel', {
              name: envelope.name,
            }),
            amount: event.amount,
            type: 'spending',
            accountId: event.accountId,
            memberId: envelope.memberId,
            dayOfMonth: null,
            date: event.date || null,
            endDate: null,
            toAccountId: null,
            category: this._i18n.translate('budget.envelope.messages.envelopeCreditCategory'),
            payslipKey: null,
            autoPost: false,
            autoPostSince: null,
          }),
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
