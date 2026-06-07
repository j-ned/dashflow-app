import { Injectable, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap } from 'rxjs';
import { RecurringEntryGateway } from '../../domain/gateways/recurring-entry.gateway';
import { BankAccountGateway } from '../../domain/gateways/bank-account.gateway';
import { MemberGateway } from '../../domain/gateways/member.gateway';
import { AccountTransactionGateway } from '../../domain/gateways/account-transaction.gateway';
import { AccountTransaction } from '../../domain/models/account-transaction.model';

@Injectable()
export class BudgetDataStore {
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly accountGateway = inject(BankAccountGateway);
  private readonly memberGateway = inject(MemberGateway);
  private readonly txGateway = inject(AccountTransactionGateway);

  private readonly _refresh = signal(0);
  private readonly _refreshAccounts = signal(0);
  private readonly _refreshTx = signal(0);
  private readonly _entriesLoaded = signal(false);
  private readonly _txLoaded = signal(false);

  readonly entries = toSignal(
    toObservable(this._refresh).pipe(
      switchMap(() => this.entryGateway.getAll()),
      tap(() => this._entriesLoaded.set(true)),
    ),
    { initialValue: [] },
  );

  readonly accounts = toSignal(
    toObservable(this._refreshAccounts).pipe(switchMap(() => this.accountGateway.getAll())),
    { initialValue: [] },
  );

  readonly members = toSignal(this.memberGateway.getAll(), { initialValue: [] });

  readonly transactions = toSignal(
    toObservable(this._refreshTx).pipe(
      switchMap(() => this.txGateway.getAll()),
      tap(() => this._txLoaded.set(true)),
    ),
    { initialValue: [] as AccountTransaction[] },
  );

  readonly entriesLoaded = this._entriesLoaded.asReadonly();
  readonly transactionsLoaded = this._txLoaded.asReadonly();

  readonly selectedAccountId = linkedSignal<string | null>(() => {
    const accs = this.accounts();
    return accs.length > 0 ? accs[0].id : null;
  });

  selectAccount(id: string | null): void {
    this.selectedAccountId.set(id);
  }

  refreshEntries(): void {
    this._refresh.update((v) => v + 1);
  }
  refreshAccounts(): void {
    this._refreshAccounts.update((v) => v + 1);
  }
  refreshTransactions(): void {
    this._refreshTx.update((v) => v + 1);
  }
}
