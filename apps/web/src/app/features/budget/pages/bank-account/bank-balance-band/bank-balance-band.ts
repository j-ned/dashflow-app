import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from '@shared/components/icon/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Bandeau "héros" du compte : raconte la trajectoire du solde,
 * du réel (confirmé, issu du relevé) vers l'estimé (projeté fin de mois).
 * Remplace l'ancienne grille de 6 cartes KPI sans hiérarchie.
 */
@Component({
  selector: 'app-bank-balance-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, RouterLink, Icon, TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section class="overflow-hidden rounded-lg border border-border bg-surface">
      <div class="grid gap-px bg-border sm:grid-cols-[1fr_auto_1fr]">
        <!-- Confirmé : le réel, ancré sur le relevé -->
        <div class="bg-surface p-5">
          <p class="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {{ 'budget.bankAccount.balance.confirmedLabel' | transloco }}
          </p>
          <p
            class="mt-2 font-mono text-3xl font-bold tracking-tight"
            [class.text-ib-blue]="confirmedBalance() >= 0"
            [class.text-ib-red]="confirmedBalance() < 0"
          >
            {{ confirmedBalance() | number: '1.2-2'
            }}<span class="ml-1 text-lg text-text-muted">&euro;</span>
          </p>
          <p class="mt-1.5 text-xs text-text-muted">
            {{ 'budget.bankAccount.balance.confirmedHint' | transloco: { date: today() } }}
          </p>
        </div>

        <!-- Flèche : la trajectoire -->
        <div
          class="hidden items-center justify-center bg-surface px-3 text-text-muted sm:flex"
          aria-hidden="true"
        >
          <app-icon name="arrow-right" size="18" />
        </div>

        <!-- Projeté : l'estimé -->
        <div class="bg-surface p-5">
          <p class="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {{ 'budget.bankAccount.balance.projectedLabel' | transloco }}
          </p>
          <p
            class="mt-2 font-mono text-3xl font-bold tracking-tight"
            [class.text-ib-green]="projectedBalance() >= 0"
            [class.text-ib-red]="projectedBalance() < 0"
          >
            {{ projectedBalance() | number: '1.2-2'
            }}<span class="ml-1 text-lg text-text-muted">&euro;</span>
          </p>
          <p class="mt-1.5 text-xs text-text-muted">
            {{ 'budget.bankAccount.balance.projectedHint' | transloco }}
          </p>
        </div>
      </div>

      <!-- L'écart expliqué + accès au relevé réel -->
      <div
        class="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="text-xs text-text-muted">
          <span
            class="font-mono font-semibold"
            [class.text-ib-red]="delta() < 0"
            [class.text-ib-green]="delta() >= 0"
          >
            {{ delta() >= 0 ? '+' : '' }}{{ delta() | number: '1.2-2' }}&euro;
          </span>
          {{ 'budget.bankAccount.balance.deltaHint' | transloco }}
        </p>
        <a
          routerLink="/budget/transactions"
          class="inline-flex min-h-8 items-center gap-1.5 self-start text-xs font-medium text-ib-blue transition-colors hover:underline"
        >
          {{ 'budget.bankAccount.balance.seeStatement' | transloco }}
          <app-icon name="arrow-right" size="13" />
        </a>
      </div>
    </section>
  `,
})
export class BankBalanceBand {
  readonly confirmedBalance = input.required<number>();
  readonly projectedBalance = input.required<number>();
  readonly today = input.required<string>();

  protected readonly delta = computed(() => this.projectedBalance() - this.confirmedBalance());
}
