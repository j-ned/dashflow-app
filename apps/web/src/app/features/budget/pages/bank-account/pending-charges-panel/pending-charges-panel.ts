import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PendingCharge } from '../../../domain/pending-charge';
import { PendingChargeRow } from './pending-charge-row/pending-charge-row';

/**
 * Prélèvements et virements dont la date prévue est passée, à rapprocher du relevé réel (montant
 * prérempli). Les revenus n'arrivent jamais ici : ils se saisissent sous le solde (BankIncomeInbox),
 * et « Tout confirmer » ne peut donc jamais valider un salaire à l'aveugle.
 */
@Component({
  selector: 'app-pending-charges-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, PendingChargeRow],
  host: { class: 'block' },
  template: `
    @if (charges().length > 0) {
      <section
        data-testid="pending-panel"
        aria-labelledby="pending-debits-title"
        class="mb-4 rounded-lg border border-ib-orange/40 bg-surface p-4"
      >
        <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <h2
              id="pending-debits-title"
              class="flex items-center gap-2 text-sm font-semibold text-text-primary"
            >
              <span
                class="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-ib-orange/15 px-1 font-mono text-xs text-ib-orange"
                >{{ charges().length }}</span
              >
              {{ 'budget.bankAccount.pending.title' | transloco }}
            </h2>
            <p class="mt-1.5 max-w-prose text-xs leading-relaxed text-text-muted">
              {{ 'budget.bankAccount.pending.help' | transloco }}
            </p>
          </div>
          <div class="flex shrink-0 flex-wrap items-center gap-2 self-start">
            @if (automatableCount() > 0) {
              <button
                type="button"
                data-testid="automate-all"
                class="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-text-muted transition-colors hover:border-ib-green/40 hover:text-ib-green"
                (click)="automateAll.emit()"
              >
                {{ 'budget.bankAccount.pending.automateAll' | transloco }}
              </button>
            }
            <button
              type="button"
              data-testid="confirm-all"
              class="rounded-md bg-ib-green/15 px-2.5 py-1 text-xs font-medium text-ib-green transition-colors hover:bg-ib-green/25"
              (click)="confirmAll.emit()"
            >
              {{ 'budget.bankAccount.pending.confirmAll' | transloco }}
            </button>
          </div>
        </div>

        <ul class="divide-y divide-border/40">
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
export class PendingChargesPanel {
  /** Prélèvements et virements uniquement : le parent en exclut les revenus. */
  readonly charges = input.required<readonly PendingCharge[]>();
  readonly accountNameById = input.required<(id: string | null) => string | null>();
  readonly confirm = output<{ id: string; amount: number }>();
  readonly confirmAll = output<void>();
  readonly ignore = output<string>();
  /** Nombre de prélèvements fixes encore confirmés à la main : propose de les automatiser. */
  readonly automatableCount = input(0);
  readonly automateAll = output<void>();
}
