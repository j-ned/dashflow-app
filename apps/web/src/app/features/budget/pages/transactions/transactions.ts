import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountTransaction } from '../../domain/models/account-transaction.model';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { confirmedBalance } from '../../domain/account-balance';
import { CATEGORY_GROUPS, categoryMeta } from '../../domain/categories';

type TransactionViewModel = AccountTransaction & { categoryLabel: string; categoryColor: string; isCredit: boolean };

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule],
  host: { class: 'block p-6' },
  template: `
    <h1 class="text-xl font-semibold mb-4">Relevé</h1>

    <div class="flex flex-wrap gap-2 mb-4">
      @for (acc of accounts(); track acc.id) {
        <button type="button"
          class="px-3 py-1.5 rounded-lg text-sm"
          [class.bg-raised]="selectedId() === acc.id"
          (click)="selectedId.set(acc.id)">{{ acc.name }}</button>
      }
    </div>

    <p class="text-2xl font-bold mb-6" data-testid="confirmed-balance">
      {{ confirmedBalanceValue() | number: '1.2-2' }} €
      <span class="text-sm font-normal text-text-muted">solde confirmé</span>
    </p>

    <!-- Add form -->
    <div class="flex flex-wrap gap-2 mb-6 p-4 bg-raised rounded-xl">
      <input type="number" min="0" step="0.01"
        class="w-28 rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        placeholder="Montant"
        [ngModel]="draftAmount()"
        (ngModelChange)="draftAmount.set($event)" />

      <select class="rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [ngModel]="draftDirection()"
        (ngModelChange)="draftDirection.set($event)">
        <option value="expense">Dépense</option>
        <option value="income">Revenu</option>
        <option value="transfer">Virement</option>
      </select>

      <input type="date"
        class="rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [ngModel]="draftDate()"
        (ngModelChange)="draftDate.set($event)" />

      <select class="rounded-lg border border-border/40 bg-canvas px-3 py-1.5 text-sm"
        [ngModel]="draftCategory()"
        (ngModelChange)="draftCategory.set($event)">
        @for (group of categoryGroups; track group.key) {
          <optgroup [label]="group.label">
            @for (cat of group.categories; track cat.key) {
              <option [value]="cat.key">{{ cat.label }}</option>
            }
          </optgroup>
        }
      </select>

      <button type="button"
        class="rounded-lg bg-ib-blue px-4 py-1.5 text-sm font-medium text-canvas"
        (click)="addTransaction()">Ajouter</button>
    </div>

    @if (transactions().length === 0) {
      <p class="text-text-muted">Aucun mouvement réel pour ce compte.</p>
    } @else {
      <ul class="divide-y divide-border/40">
        @for (t of transactions(); track t.id) {
          <li class="flex items-center justify-between py-2">
            <span>
              <span class="inline-block w-2 h-2 rounded-full mr-2" [style.background]="t.categoryColor"></span>
              {{ t.date }} — {{ t.note || t.categoryLabel }}
            </span>
            <span class="flex items-center gap-3">
              <span [class.text-ib-green]="t.isCredit">
                {{ t.isCredit ? '+' : '−' }}{{ t.amount | number: '1.2-2' }} €
              </span>
              <button type="button"
                class="text-xs text-text-muted hover:text-ib-red transition-colors"
                (click)="removeTransaction(t.id)">Supprimer</button>
            </span>
          </li>
        }
      </ul>
    }
  `,
})
export class Transactions {
  private readonly _accountGateway = inject(BankAccountGateway);
  private readonly _txGateway = inject(AccountTransactionGateway);
  private readonly _destroyRef = inject(DestroyRef);

  protected readonly accounts = toSignal(this._accountGateway.getAll(), { initialValue: [] });
  protected readonly selectedId = signal<string | null>(null);

  protected readonly categoryGroups = CATEGORY_GROUPS;

  // Reloadable signal — populated via manual subscribe so we can trigger reload after mutations
  private readonly _allTx = signal<AccountTransaction[]>([]);
  protected readonly allTx = this._allTx.asReadonly();
  private _reloadSub?: Subscription;

  constructor() { this.reload(); }

  private reload(): void {
    this._reloadSub?.unsubscribe();
    this._reloadSub = this._txGateway.getAll()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((txs) => this._allTx.set(txs));
  }

  private readonly _currentAccount = computed(() => {
    const id = this.selectedId() ?? this.accounts()[0]?.id ?? null;
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  protected readonly transactions = computed<TransactionViewModel[]>(() => {
    const acc = this._currentAccount();
    if (!acc) return [];
    return this.allTx()
      .filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((t) => {
        const meta = categoryMeta(t.category);
        const isCredit = t.direction === 'income' || (t.direction === 'transfer' && t.toAccountId === acc.id);
        return { ...t, categoryLabel: meta.label, categoryColor: meta.color, isCredit };
      });
  });

  protected readonly confirmedBalanceValue = computed(() => {
    const acc = this._currentAccount();
    if (!acc) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return confirmedBalance(acc, this.transactions(), today);
  });

  // Draft signals
  protected readonly draftAmount = signal<number>(0);
  protected readonly draftDirection = signal<'income' | 'expense' | 'transfer'>('expense');
  protected readonly draftDate = signal<string>(new Date().toISOString().slice(0, 10));
  protected readonly draftCategory = signal<string>('other');

  protected addTransaction(): void {
    const acc = this._currentAccount();
    if (!acc) return;
    this._txGateway.create(acc.id, {
      amount: Math.abs(this.draftAmount()),
      direction: this.draftDirection(),
      toAccountId: null,
      date: this.draftDate(),
      category: this.draftCategory(),
      note: null,
      memberId: null,
      recurringEntryId: null,
    }).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
      this.draftAmount.set(0);
      this.reload();
    });
  }

  protected removeTransaction(id: string): void {
    this._txGateway.delete(id).pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => this.reload());
  }
}
