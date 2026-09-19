import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountTransaction } from '../../domain/models/account-transaction.model';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { AUTO_POST_NOTE } from '../../domain/auto-post';
import { confirmedBalance } from '../../domain/account-balance';
import { CATEGORY_GROUPS, categoryMeta } from '../../domain/categories';
import { TranslocoPipe } from '@jsverse/transloco';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Toaster } from '@shared/components/toast/toast';
import { CsvImportWizard } from './csv-import-wizard/csv-import-wizard';
import { todayIso } from '@shared/utils/local-date';

type TransactionViewModel = AccountTransaction & {
  categoryLabel: string;
  /** Ce qu'on lit dans la liste : libellé de la récurrence d'origine, sinon la note, sinon la catégorie. */
  title: string;
  /** Opération enregistrée toute seule par le pointage automatique. */
  auto: boolean;
  categoryColor: string;
  isCredit: boolean;
};

/** Temps laissé pour annuler une suppression. */
const UNDO_WINDOW_MS = 6000;

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslocoPipe, ModalDialog, CsvImportWizard],
  host: { class: 'block p-6' },
  template: `
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-xl font-semibold">{{ 'budget.transactions.title' | transloco }}</h1>
      <button
        type="button"
        class="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-hover hover:text-text-primary transition-colors"
        (click)="importModalRef().open()"
      >
        {{ 'budget.transactions.import.button' | transloco }}
      </button>
    </div>

    <div class="flex flex-wrap gap-2 mb-4">
      @for (acc of accounts(); track acc.id) {
        <button
          type="button"
          class="px-3 py-1.5 rounded-lg text-sm text-text-muted hover:bg-hover hover:text-text-primary transition-colors"
          [class.bg-ib-blue-10]="currentAccount()?.id === acc.id"
          [class.!text-ib-blue]="currentAccount()?.id === acc.id"
          [attr.aria-pressed]="currentAccount()?.id === acc.id"
          (click)="selectedId.set(acc.id)"
        >
          {{ acc.name }}
        </button>
      }
    </div>

    <p class="text-2xl font-bold mb-6" data-testid="confirmed-balance">
      {{ confirmedBalanceValue() | number: '1.2-2' }} €
      <span class="text-sm font-normal text-text-muted">{{
        'budget.transactions.confirmedBalance' | transloco
      }}</span>
    </p>

    <!-- Add form -->
    <div class="flex flex-wrap gap-2 mb-6 p-4 bg-raised rounded-xl">
      <input
        type="number"
        min="0"
        step="0.01"
        class="w-28 rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [placeholder]="'budget.transactions.amountPlaceholder' | transloco"
        [attr.aria-label]="'budget.transactions.amountPlaceholder' | transloco"
        [ngModel]="draftAmount()"
        (ngModelChange)="draftAmount.set($event)"
      />

      <select
        class="rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [attr.aria-label]="'budget.transactions.directionLabel' | transloco"
        [ngModel]="draftDirection()"
        (ngModelChange)="draftDirection.set($event)"
      >
        <option value="expense">{{ 'budget.transactions.direction.expense' | transloco }}</option>
        <option value="income">{{ 'budget.transactions.direction.income' | transloco }}</option>
        <option value="transfer">{{ 'budget.transactions.direction.transfer' | transloco }}</option>
      </select>

      <input
        type="date"
        class="rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [attr.aria-label]="'budget.transactions.dateLabel' | transloco"
        [ngModel]="draftDate()"
        (ngModelChange)="draftDate.set($event)"
      />

      <select
        class="rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [attr.aria-label]="'budget.transactions.categoryLabel' | transloco"
        [ngModel]="draftCategory()"
        (ngModelChange)="draftCategory.set($event)"
      >
        @for (group of categoryGroups; track group.key) {
          <optgroup [label]="group.label">
            @for (cat of group.categories; track cat.key) {
              <option [value]="cat.key">{{ cat.label }}</option>
            }
          </optgroup>
        }
      </select>

      <button
        type="button"
        class="rounded-lg bg-ib-blue px-4 py-1.5 text-sm font-medium text-canvas"
        (click)="addTransaction()"
      >
        {{ 'budget.transactions.add' | transloco }}
      </button>
    </div>

    @if (transactions().length === 0) {
      <p class="text-text-muted">{{ 'budget.transactions.empty' | transloco }}</p>
    } @else {
      <ul class="divide-y divide-border/40">
        @for (t of transactions(); track t.id) {
          <li class="flex items-center justify-between gap-3 py-2">
            <span class="min-w-0">
              <span
                class="inline-block w-2 h-2 rounded-full mr-2"
                [style.background]="t.categoryColor"
              ></span>
              {{ t.date | date: 'd MMM y' }} · {{ t.title }}
              @if (t.auto) {
                <span
                  data-testid="tx-auto-badge"
                  class="ml-1.5 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ib-green bg-ib-green/10"
                  >{{ 'budget.recurringForm.autoBadge' | transloco }}</span
                >
              }
            </span>
            <span class="flex shrink-0 items-center gap-3">
              <span class="whitespace-nowrap" [class.text-ib-green]="t.isCredit">
                {{ t.isCredit ? '+' : '−' }}{{ t.amount | number: '1.2-2' }} €
              </span>
              <button
                type="button"
                class="text-xs text-text-muted hover:text-ib-red transition-colors"
                (click)="removeTransaction(t.id)"
              >
                {{ 'budget.transactions.delete' | transloco }}
              </button>
            </span>
          </li>
        }
      </ul>
    }

    <app-modal-dialog
      #importModal
      [title]="'budget.transactions.import.title' | transloco"
      size="xl"
    >
      @if (importModalRef().isOpen()) {
        <app-csv-import-wizard
          [accountId]="currentAccount()?.id ?? ''"
          [existing]="existingForImport()"
          (imported)="onImported()"
        />
      }
    </app-modal-dialog>
  `,
})
export class Transactions {
  private readonly _accountGateway = inject(BankAccountGateway);
  private readonly _txGateway = inject(AccountTransactionGateway);
  private readonly _entryGateway = inject(RecurringEntryGateway);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _toaster = inject(Toaster);

  protected readonly importModalRef = viewChild.required<ModalDialog>('importModal');

  protected readonly accounts = toSignal(this._accountGateway.getAll(), { initialValue: [] });
  protected readonly selectedId = signal<string | null>(null);

  protected readonly categoryGroups = CATEGORY_GROUPS;

  // GET réactif full-signal : rxResource enveloppe le gateway (préserve l'abstraction)
  // et expose .reload() pour rafraîchir après mutation.
  private readonly _txResource = rxResource({
    stream: () => this._txGateway.getAll(),
    defaultValue: [] as AccountTransaction[],
  });
  protected readonly allTx = this._txResource.value;

  protected readonly currentAccount = computed(() => {
    const id = this.selectedId() ?? this.accounts()[0]?.id ?? null;
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  // Libellé des récurrences, pour nommer les opérations qu'elles ont générées : une opération
  // pointée automatiquement porte la note technique « auto », pas « Loyer ».
  private readonly _entryLabels = toSignal(
    this._entryGateway
      .getAll()
      .pipe(map((entries) => new Map(entries.map((e) => [e.id, e.label] as const)))),
    { initialValue: new Map<string, string>() },
  );

  protected readonly transactions = computed<TransactionViewModel[]>(() => {
    const acc = this.currentAccount();
    if (!acc) return [];
    return this.allTx()
      .filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((t) => {
        const meta = categoryMeta(t.category);
        const isCredit =
          t.direction === 'income' || (t.direction === 'transfer' && t.toAccountId === acc.id);
        const auto = t.note === AUTO_POST_NOTE;
        const entryLabel = t.recurringEntryId ? this._entryLabels().get(t.recurringEntryId) : null;
        const title = entryLabel ?? (auto ? null : t.note) ?? meta.label;
        return {
          ...t,
          categoryLabel: meta.label,
          categoryColor: meta.color,
          isCredit,
          title,
          auto,
        };
      });
  });

  protected readonly confirmedBalanceValue = computed(() => {
    const acc = this.currentAccount();
    if (!acc) return 0;
    const today = todayIso();
    return confirmedBalance(acc, this.transactions(), today);
  });

  // Draft signals
  protected readonly draftAmount = signal<number>(0);
  protected readonly draftDirection = signal<'income' | 'expense' | 'transfer'>('expense');
  protected readonly draftDate = signal<string>(todayIso());
  protected readonly draftCategory = signal<string>('other');

  protected addTransaction(): void {
    const acc = this.currentAccount();
    if (!acc) return;
    this._txGateway
      .create(acc.id, {
        amount: Math.abs(this.draftAmount()),
        direction: this.draftDirection(),
        toAccountId: null,
        date: this.draftDate(),
        category: this.draftCategory(),
        note: null,
        memberId: null,
        recurringEntryId: null,
      })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        this.draftAmount.set(0);
        this._txResource.reload();
      });
  }

  /** Supprime sans confirmation, mais laisse quelques secondes pour revenir en arrière. */
  protected removeTransaction(id: string): void {
    const removed = this.allTx().find((t) => t.id === id);
    this._txGateway
      .delete(id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this._txResource.reload();
          this._toaster.success('budget.transactions.feedback.deleted', undefined, {
            duration: UNDO_WINDOW_MS,
            action: removed && {
              labelKey: 'shared.toast.undo',
              run: () => this.restoreTransaction(removed),
            },
          });
        },
        error: () => this._toaster.error('budget.transactions.feedback.deleteFailed'),
      });
  }

  /** Annuler une suppression = recréer l'opération à l'identique (elle reçoit un nouvel id). */
  private restoreTransaction(removed: AccountTransaction): void {
    const { id: _id, accountId, ...data } = removed;
    this._txGateway
      .create(accountId, data)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this._txResource.reload();
          this._toaster.success('budget.transactions.feedback.restored');
        },
        error: () => this._toaster.error('budget.transactions.feedback.restoreFailed'),
      });
  }

  protected readonly existingForImport = computed(() =>
    this.allTx()
      .filter((t) => t.accountId === (this.currentAccount()?.id ?? ''))
      .map((t) => ({ date: t.date, amount: t.amount, note: t.note })),
  );

  protected onImported(): void {
    this.importModalRef().close();
    this._txResource.reload();
  }
}
