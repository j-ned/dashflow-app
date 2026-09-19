import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PendingCharge, isIncomeCharge } from '../../../domain/pending-charge';
import { PendingChargeRow } from './pending-charge-row/pending-charge-row';

/**
 * Récurrences dont la date prévue est passée, à rapprocher du relevé réel. Deux listes, parce que
 * ce sont deux gestes :
 * - « Revenus à saisir » : un revenu se reçoit. S'il est à montant variable, rien n'est prérempli ;
 * - « Échéances à confirmer » : un prélèvement ou un virement se débite, montant prérempli.
 * « Tout confirmer » ne porte que sur la seconde liste : un salaire ne se confirme pas à l'aveugle.
 */
@Component({
  selector: 'app-pending-charges-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, PendingChargeRow],
  host: { class: 'block' },
  template: `
    @if (incomes().length > 0) {
      <section
        id="pending-incomes"
        data-testid="pending-incomes"
        aria-labelledby="pending-incomes-title"
        class="mb-4 rounded-lg border border-ib-green/40 bg-surface p-4"
      >
        <h2 id="pending-incomes-title" class="text-sm font-semibold text-text-primary">
          {{ 'budget.bankAccount.pending.incomesTitle' | transloco }}
        </h2>
        <p class="mt-1.5 max-w-prose text-xs leading-relaxed text-text-muted">
          {{ 'budget.bankAccount.pending.incomesHelp' | transloco }}
        </p>
        <ul class="mt-2 divide-y divide-border/40">
          @for (c of incomes(); track c.entry.id) {
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

    @if (debits().length > 0) {
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
                >{{ debits().length }}</span
              >
              {{ 'budget.bankAccount.pending.title' | transloco }}
            </h2>
            <p class="mt-1.5 max-w-prose text-xs leading-relaxed text-text-muted">
              {{ 'budget.bankAccount.pending.help' | transloco }}
            </p>
          </div>
          <button
            type="button"
            data-testid="confirm-all"
            class="shrink-0 self-start rounded-md bg-ib-green/15 px-2.5 py-1 text-xs font-medium text-ib-green transition-colors hover:bg-ib-green/25"
            (click)="confirmAll.emit()"
          >
            {{ 'budget.bankAccount.pending.confirmAll' | transloco }}
          </button>
        </div>

        <ul class="divide-y divide-border/40">
          @for (c of debits(); track c.entry.id) {
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
  readonly charges = input.required<PendingCharge[]>();
  readonly accountNameById = input.required<(id: string | null) => string | null>();
  readonly confirm = output<{ id: string; amount: number }>();
  /** Ne concerne que les prélèvements et virements : un revenu ne se confirme jamais en lot. */
  readonly confirmAll = output<void>();
  readonly ignore = output<string>();

  protected readonly incomes = computed(() => this.charges().filter(isIncomeCharge));
  protected readonly debits = computed(() => this.charges().filter((c) => !isIncomeCharge(c)));
}
