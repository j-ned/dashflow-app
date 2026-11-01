import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { PendingCharge, isIncomeCharge } from '../../../../domain/pending-charge';

/**
 * Une échéance à rapprocher du relevé. Le vocabulaire suit le sens de l'argent : un revenu se
 * « reçoit », un prélèvement se « débite ». Un revenu à montant variable arrive avec un champ
 * vide : tant qu'aucun montant positif n'est saisi, il ne peut pas être confirmé.
 */
@Component({
  selector: 'app-pending-charge-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, TranslocoPipe],
  host: { class: 'flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5' },
  template: `
    <span class="min-w-0 text-sm text-text-primary">
      {{ charge().entry.label }}
      <span class="text-xs text-text-muted"
        >&middot;
        {{
          'budget.bankAccount.pending.dueOn'
            | transloco: { date: charge().suggestedDate | date: 'd MMM' }
        }}</span
      >
    </span>
    <span class="flex items-center gap-2">
      <span class="relative">
        <input
          type="number"
          step="0.01"
          min="0"
          class="w-28 rounded-md border border-border bg-canvas py-1 pl-2 pr-6 text-right font-mono text-sm text-text-primary"
          [attr.data-testid]="'amount-' + charge().entry.id"
          [attr.placeholder]="
            charge().suggestedAmount === null
              ? ('budget.bankAccount.pending.amountPlaceholder' | transloco)
              : null
          "
          [attr.aria-label]="
            (income()
              ? 'budget.bankAccount.pending.amountReceivedAria'
              : 'budget.bankAccount.pending.amountAria'
            ) | transloco: { label: charge().entry.label }
          "
          [ngModel]="amount()"
          (ngModelChange)="amount.set($event)"
        />
        <span
          class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted"
          aria-hidden="true"
          >&euro;</span
        >
      </span>
      <button
        type="button"
        [attr.data-testid]="'confirm-' + charge().entry.id"
        class="rounded-md bg-ib-green/15 px-2.5 py-1 text-xs font-medium text-ib-green transition-colors hover:bg-ib-green/25 disabled:cursor-not-allowed disabled:opacity-40"
        [disabled]="validAmount() === null"
        (click)="confirmCharge()"
      >
        {{
          (income() ? 'budget.bankAccount.pending.received' : 'budget.bankAccount.pending.confirm')
            | transloco
        }}
      </button>
      <button
        type="button"
        [attr.data-testid]="'ignore-' + charge().entry.id"
        class="rounded-md px-2.5 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
        (click)="ignore.emit(charge().entry.id)"
      >
        {{
          (income()
            ? 'budget.bankAccount.pending.notReceived'
            : 'budget.bankAccount.pending.ignore'
          ) | transloco
        }}
      </button>
    </span>
  `,
})
export class PendingChargeRow {
  readonly charge = input.required<PendingCharge>();
  readonly confirm = output<{ id: string; amount: number }>();
  readonly ignore = output<string>();

  protected readonly income = computed(() => isIncomeCharge(this.charge()));
  protected readonly amount = linkedSignal<number | null>(() => this.charge().suggestedAmount);
  protected readonly validAmount = computed(() => {
    const value = this.amount();
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  });

  protected confirmCharge(): void {
    const amount = this.validAmount();
    if (amount !== null) this.confirm.emit({ id: this.charge().entry.id, amount });
  }
}
