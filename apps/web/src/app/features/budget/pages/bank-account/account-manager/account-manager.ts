import {
  ChangeDetectionStrategy, Component, inject, input, model, output, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  BankAccount, BankAccountType, BANK_ACCOUNT_TYPES,
} from '../../../domain/models/bank-account.model';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';
import { BankAccountGateway } from '../../../domain/gateways/bank-account.gateway';
import { RecurringEntryGateway } from '../../../domain/gateways/recurring-entry.gateway';
import { ModalDialog } from '@shared/components/modal-dialog/modal-dialog';
import { Icon } from '@shared/components/icon/icon';
import { Toaster } from '@shared/components/toast/toast';
import { ConfirmService } from '@shared/components/confirm-dialog/confirm-dialog';

type DecoratedAccount = { account: BankAccount; color: string; dot: string };

@Component({
  selector: 'app-account-manager',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, Icon, ModalDialog, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <app-modal-dialog
      #accountModal
      [title]="'budget.bankAccount.accountModal.title' | transloco"
      (closed)="resetAccountForm()"
    >
      @if (accountModal.isOpen()) {
        <div class="space-y-6">
          @if (decoratedAccounts().length > 0) {
            <div>
              <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                {{ 'budget.bankAccount.accountModal.existing' | transloco }}
              </p>
              <div
                class="rounded-xl border border-border overflow-hidden divide-y divide-border/30"
              >
                @for (da of decoratedAccounts(); track da.account.id) {
                  <div class="px-4 py-3 hover:bg-hover/30 transition-colors space-y-2">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-3">
                        <span class="inline-flex items-center gap-2">
                          <span
                            class="inline-block h-3 w-3 rounded-full"
                            [style.background-color]="da.dot"
                          ></span>
                          <span
                            class="inline-block h-4 w-4 rounded-md"
                            [style.background-color]="da.color"
                          ></span>
                        </span>
                        <input
                          type="text"
                          class="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-text-primary hover:border-border focus:border-border focus:bg-raised focus-visible:outline-none"
                          [value]="da.account.name"
                          [attr.aria-label]="
                            'budget.bankAccount.accountModal.renameAria'
                              | transloco: { name: da.account.name }
                          "
                          (change)="updateAccountName(da.account, $event)"
                        />
                      </div>
                      <button
                        type="button"
                        class="rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors"
                        [title]="
                          'budget.bankAccount.accountModal.deleteTitle'
                            | transloco: { name: da.account.name }
                        "
                        [attr.aria-label]="
                          'budget.bankAccount.accountModal.deleteAria'
                            | transloco: { name: da.account.name }
                        "
                        (click)="deleteAccount(da.account)"
                      >
                        <app-icon name="trash" size="14" />
                      </button>
                    </div>
                    <div class="flex items-center gap-2 pl-10">
                      <label
                        [for]="'acct-balance-' + da.account.id"
                        class="text-[11px] text-text-muted whitespace-nowrap"
                        >{{ 'budget.bankAccount.accountModal.currentBalance' | transloco }}</label
                      >
                      <input
                        [id]="'acct-balance-' + da.account.id"
                        type="number"
                        step="0.01"
                        class="w-32 rounded-lg border border-border bg-raised px-2 py-1 text-xs font-mono text-text-primary text-right"
                        [value]="da.account.initialBalance"
                        (change)="updateAccountBalance(da.account, $event)"
                      />
                      <span class="text-[11px] text-text-muted">&euro;</span>
                    </div>
                    <div class="flex items-center gap-2 pl-10">
                      <label
                        [for]="'acct-type-' + da.account.id"
                        class="text-[11px] text-text-muted whitespace-nowrap"
                        >{{ 'budget.bankAccount.accountModal.type' | transloco }}</label
                      >
                      <select
                        [id]="'acct-type-' + da.account.id"
                        class="rounded-lg border border-border bg-raised px-2 py-1 text-xs text-text-primary"
                        [value]="da.account.type"
                        (change)="updateAccountType(da.account, $event)"
                        [attr.aria-label]="
                          'budget.bankAccount.accountModal.typeAria'
                            | transloco: { name: da.account.name }
                        "
                      >
                        @for (t of ACCOUNT_TYPES; track t) {
                          <option [value]="t">
                            {{ 'budget.bankAccount.type.' + t | transloco }}
                          </option>
                        }
                      </select>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <div>
            <p class="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
              {{ 'budget.bankAccount.accountModal.addAccount' | transloco }}
            </p>
            <form (ngSubmit)="createAccount()" class="space-y-3">
              <div>
                <label for="acc-name" class="block text-sm font-medium text-text-muted mb-1"
                  >{{ 'budget.bankAccount.accountModal.name' | transloco }}
                  <span aria-hidden="true">*</span></label
                >
                <input
                  id="acc-name"
                  type="text"
                  [ngModel]="newAccountName()"
                  (ngModelChange)="newAccountName.set($event)"
                  name="name"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                  [placeholder]="'budget.bankAccount.accountModal.namePlaceholder' | transloco"
                />
              </div>
              <div>
                <label for="acc-type" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.bankAccount.accountModal.type' | transloco
                }}</label>
                <select
                  id="acc-type"
                  [ngModel]="newAccountType()"
                  (ngModelChange)="newAccountType.set($event)"
                  name="type"
                  class="w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm text-text-primary"
                >
                  @for (t of ACCOUNT_TYPES; track t) {
                    <option [ngValue]="t">{{ 'budget.bankAccount.type.' + t | transloco }}</option>
                  }
                </select>
              </div>
              <div>
                <label for="acc-balance" class="block text-sm font-medium text-text-muted mb-1">{{
                  'budget.bankAccount.accountModal.initialBalance' | transloco
                }}</label>
                <div class="relative">
                  <input
                    id="acc-balance"
                    type="number"
                    step="0.01"
                    [ngModel]="newAccountBalance()"
                    (ngModelChange)="newAccountBalance.set($event)"
                    name="balance"
                    class="w-full rounded-lg border border-border bg-raised px-3 py-2 pr-8 text-sm font-mono text-text-primary"
                    placeholder="0.00"
                  />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted"
                    >&euro;</span
                  >
                </div>
                <p class="mt-1 text-xs text-text-muted">
                  {{ 'budget.bankAccount.accountModal.balanceHint' | transloco }}
                </p>
              </div>
              <p class="text-xs text-text-muted">
                {{ 'budget.bankAccount.accountModal.colorsAuto' | transloco }}
              </p>
              <footer class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded-lg border border-border px-4 py-2 text-sm text-text-muted hover:bg-hover transition-colors"
                  (click)="accountModalRef().close()"
                >
                  {{ 'common.close' | transloco }}
                </button>
                <button
                  type="submit"
                  [disabled]="!newAccountName().trim()"
                  class="rounded-lg bg-ib-cyan px-4 py-2 text-sm font-medium text-canvas hover:bg-ib-cyan/90 transition-colors disabled:opacity-50"
                >
                  {{ 'budget.actions.add' | transloco }}
                </button>
              </footer>
            </form>
          </div>
        </div>
      }
    </app-modal-dialog>
  `,
})
export class AccountManager {
  private readonly accountGateway = inject(BankAccountGateway);
  private readonly entryGateway = inject(RecurringEntryGateway);
  private readonly toaster = inject(Toaster);
  private readonly confirm = inject(ConfirmService);
  private readonly _i18n = inject(TranslocoService);

  readonly decoratedAccounts = input.required<DecoratedAccount[]>();
  readonly entries = input.required<RecurringEntry[]>();
  readonly selectedAccountId = model<string | null>(null);
  readonly accountsChanged = output<void>();
  readonly entriesChanged = output<void>();

  protected readonly accountModalRef = viewChild.required<ModalDialog>('accountModal');

  protected readonly newAccountName = signal('');
  protected readonly newAccountType = signal<BankAccountType>('courant');
  protected readonly newAccountBalance = signal<number>(0);
  protected readonly ACCOUNT_TYPES = BANK_ACCOUNT_TYPES;

  open(): void {
    this.accountModalRef().open();
  }

  protected resetAccountForm() {
    this.newAccountName.set('');
    this.newAccountType.set('courant');
    this.newAccountBalance.set(0);
  }

  protected async createAccount() {
    const name = this.newAccountName().trim();
    if (!name) return;
    try {
      await lastValueFrom(
        this.accountGateway.create({
          name, type: this.newAccountType(), initialBalance: this.newAccountBalance(),
          color: null, dotColor: null,
        }),
      );
      this.toaster.success('budget.bankAccount.messages.accountCreated');
      this.resetAccountForm();
      this.accountsChanged.emit();
    } catch {
      this.toaster.error('budget.bankAccount.messages.accountCreateError');
    }
  }

  // En E2EE, l'update remplace tout le blob chiffré → on renvoie TOUJOURS le compte complet.
  private async persistAccount(
    account: BankAccount,
    changes: Partial<Omit<BankAccount, 'id'>>,
    successKey: string,
    errorKey: string,
  ) {
    try {
      await lastValueFrom(
        this.accountGateway.update(account.id, {
          name: account.name, type: account.type, initialBalance: account.initialBalance,
          color: account.color, dotColor: account.dotColor, ...changes,
        }),
      );
      this.toaster.success(successKey);
      this.accountsChanged.emit();
    } catch {
      this.toaster.error(errorKey);
    }
  }

  protected updateAccountBalance(account: BankAccount, event: Event) {
    const value = Number((event.target as HTMLInputElement).value);
    return this.persistAccount(account, { initialBalance: value },
      'budget.bankAccount.messages.balanceUpdated', 'budget.bankAccount.messages.balanceUpdateError');
  }

  protected updateAccountName(account: BankAccount, event: Event) {
    const name = (event.target as HTMLInputElement).value.trim();
    if (!name) {
      this.accountsChanged.emit(); // annule la saisie vide
      return;
    }
    return this.persistAccount(account, { name },
      'budget.bankAccount.messages.nameUpdated', 'budget.bankAccount.messages.nameUpdateError');
  }

  protected updateAccountType(account: BankAccount, event: Event) {
    const type = (event.target as HTMLSelectElement).value as BankAccountType;
    return this.persistAccount(account, { type },
      'budget.bankAccount.messages.typeUpdated', 'budget.bankAccount.messages.typeUpdateError');
  }

  protected async deleteAccount(account: BankAccount) {
    const accounts = this.decoratedAccounts().map((d) => d.account);
    const entries = this.entries().filter((e) => e.accountId === account.id);

    if (entries.length > 0) {
      const others = accounts.filter((a) => a.id !== account.id);
      const target = others.find((a) => a.id === this.selectedAccountId()) ?? others[0] ?? null;

      let mode: 'reassign' | 'deleteEntries';
      if (target) {
        const choice = await this.confirm.choose({
          title: this._i18n.translate('budget.bankAccount.deleteWithEntries.title'),
          message: this._i18n.translate('budget.bankAccount.deleteWithEntries.message', { count: entries.length }),
          confirmLabel: this._i18n.translate('budget.bankAccount.deleteWithEntries.reassignTo', { name: target.name }),
          alternativeLabel: this._i18n.translate('budget.bankAccount.deleteWithEntries.deleteEntries'),
          cancelLabel: this._i18n.translate('common.cancel'),
          variant: 'danger',
        });
        if (choice === 'cancel') return;
        mode = choice === 'confirm' ? 'reassign' : 'deleteEntries';
      } else {
        const ok = await this.confirm.confirm({
          title: this._i18n.translate('budget.bankAccount.deleteWithEntries.title'),
          message: this._i18n.translate('budget.bankAccount.deleteWithEntries.onlyDeleteMessage', { count: entries.length }),
          confirmLabel: this._i18n.translate('budget.bankAccount.deleteWithEntries.deleteEntries'),
          variant: 'danger',
        });
        if (!ok) return;
        mode = 'deleteEntries';
      }

      try {
        if (mode === 'reassign' && target) {
          for (const e of entries) {
            const { id: _id, ...rest } = e;
            await lastValueFrom(this.entryGateway.update(e.id, { ...rest, accountId: target.id }));
          }
        } else {
          for (const e of entries) {
            await lastValueFrom(this.entryGateway.delete(e.id));
          }
        }
      } catch {
        this.toaster.error('budget.bankAccount.messages.entryReassignError');
        return;
      }
    } else {
      if (
        !(await this.confirm.confirm({
          title: this._i18n.translate('budget.bankAccount.messages.accountDeleteConfirmTitle'),
          message: this._i18n.translate('budget.bankAccount.messages.accountDeleteConfirmMessage', { name: account.name }),
          confirmLabel: this._i18n.translate('budget.actions.delete'),
          variant: 'danger',
        }))
      )
        return;
    }

    try {
      await lastValueFrom(this.accountGateway.delete(account.id));
      this.toaster.success('budget.bankAccount.messages.accountDeleted');
      if (this.selectedAccountId() === account.id) {
        this.selectedAccountId.set(null);
      }
      this.accountsChanged.emit();
      this.entriesChanged.emit();
    } catch {
      this.toaster.error('budget.bankAccount.messages.accountDeleteError');
    }
  }
}
