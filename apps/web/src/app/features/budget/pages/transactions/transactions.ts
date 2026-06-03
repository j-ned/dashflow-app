import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { confirmedBalance } from '../../domain/account-balance';
import { categoryMeta } from '../../domain/categories';

@Component({
  selector: 'app-transactions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
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

    @if (transactions().length === 0) {
      <p class="text-text-muted">Aucun mouvement réel pour ce compte.</p>
    } @else {
      <ul class="divide-y divide-border/40">
        @for (t of transactions(); track t.id) {
          <li class="flex items-center justify-between py-2">
            <span>
              <span class="inline-block w-2 h-2 rounded-full mr-2" [style.background]="categoryColor(t.category)"></span>
              {{ t.date }} — {{ t.note || categoryLabel(t.category) }}
            </span>
            <span [class.text-ib-green]="t.direction === 'income'">
              {{ t.direction === 'income' ? '+' : '−' }}{{ t.amount | number: '1.2-2' }} €
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

  protected readonly accounts = toSignal(this._accountGateway.getAll(), { initialValue: [] });
  protected readonly allTx = toSignal(this._txGateway.getAll(), { initialValue: [] });
  protected readonly selectedId = signal<string | null>(null);

  private readonly _currentAccount = computed(() => {
    const id = this.selectedId() ?? this.accounts()[0]?.id ?? null;
    return this.accounts().find((a) => a.id === id) ?? null;
  });

  protected readonly transactions = computed(() => {
    const acc = this._currentAccount();
    if (!acc) return [];
    return this.allTx()
      .filter((t) => t.accountId === acc.id || t.toAccountId === acc.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  });

  protected readonly confirmedBalanceValue = computed(() => {
    const acc = this._currentAccount();
    if (!acc) return 0;
    const today = new Date().toISOString().slice(0, 10);
    return confirmedBalance(acc, this.transactions(), today);
  });

  protected categoryLabel(code: string | null): string { return categoryMeta(code).label; }
  protected categoryColor(code: string | null): string { return categoryMeta(code).color; }
}
