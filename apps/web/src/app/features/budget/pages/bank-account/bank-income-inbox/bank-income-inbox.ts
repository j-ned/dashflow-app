import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PendingCharge } from '../../../domain/pending-charge';
import { PendingChargeRow } from '../pending-charges-panel/pending-charge-row/pending-charge-row';

/**
 * Revenus échus pas encore saisis, affichés sous le solde : un salaire reçu change le solde
 * confirmé, il se saisit là où l'on regarde le solde, pas dans une liste de tâches à part.
 */
@Component({
  selector: 'app-bank-income-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, PendingChargeRow],
  host: { class: 'block' },
  template: `
    @if (charges().length > 0) {
      <section
        data-testid="pending-incomes"
        aria-labelledby="pending-incomes-title"
        class="border-t border-border bg-ib-green/5 px-5 py-4"
      >
        <h3 id="pending-incomes-title" class="text-sm font-semibold text-text-primary">
          {{ 'budget.bankAccount.pending.incomesTitle' | transloco }}
        </h3>
        <p class="mt-1 max-w-prose text-xs text-text-muted">
          {{ 'budget.bankAccount.pending.incomesHelp' | transloco }}
        </p>
        <ul class="mt-2 divide-y divide-border/40">
          @for (c of charges(); track c.entry.id) {
            <li>
              <app-pending-charge-row
                [charge]="c"
                (confirm)="confirm.emit($event)"
                (ignore)="ignore.emit($event)"
              />
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class BankIncomeInbox {
  /** Uniquement des revenus (`direction: 'income'`). */
  readonly charges = input.required<readonly PendingCharge[]>();
  readonly confirm = output<{ id: string; amount: number }>();
  readonly ignore = output<string>();
}
