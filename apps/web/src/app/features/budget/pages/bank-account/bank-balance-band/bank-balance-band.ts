import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Icon } from '@shared/components/icon/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Bandeau "héros" du compte : raconte la trajectoire du solde,
 * du réel (confirmé, issu du relevé) vers l'estimé (projeté fin de mois).
 * Remplace l'ancienne grille de 6 cartes KPI sans hiérarchie.
 *
 * Le projeté n'est affiché que s'il repose sur des montants connus. Tant qu'un revenu à montant
 * variable (un salaire) n'a pas été saisi pour le mois, il est « incomplet » : pas de chiffre
 * inventé, seulement ce qui est sûr — le total des prélèvements encore à venir.
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
          @if (needsStartingBalance()) {
            <p
              class="mt-3 rounded-md border border-ib-blue-20 bg-ib-blue-5 p-3 text-xs leading-relaxed text-text-primary"
              data-testid="starting-balance-hint"
            >
              {{ 'budget.bankAccount.balance.startingHint' | transloco }}
            </p>
          }
          <!-- Vérification avec la banque. Un seul geste, que le compte soit vierge (le solde saisi
               devient le point de départ) ou qu'il vive déjà (l'écart devient un ajustement). -->
          <ng-content />
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
          @if (incomplete()) {
            <p
              class="mt-2 text-lg font-semibold tracking-tight text-ib-orange"
              data-testid="projection-incomplete"
            >
              {{ 'budget.bankAccount.balance.incompleteTitle' | transloco }}
            </p>
            <p class="mt-1.5 text-xs leading-relaxed text-text-muted">
              {{
                'budget.bankAccount.balance.incompleteHint'
                  | transloco: { incomes: unknownIncomes().join(', ') }
              }}
            </p>
            <a
              href="#pending-incomes"
              class="mt-2 inline-flex min-h-8 items-center gap-1.5 text-xs font-medium text-ib-blue transition-colors hover:underline"
            >
              {{ 'budget.bankAccount.balance.incompleteAction' | transloco }}
              <app-icon name="arrow-right" size="13" />
            </a>
          } @else {
            <p
              class="mt-2 font-mono text-3xl font-bold tracking-tight"
              data-testid="projected-balance"
              [class.text-ib-green]="projectedBalance() >= 0"
              [class.text-ib-red]="projectedBalance() < 0"
            >
              {{ projectedBalance() | number: '1.2-2'
              }}<span class="ml-1 text-lg text-text-muted">&euro;</span>
            </p>
            <p class="mt-1.5 text-xs text-text-muted">
              {{ 'budget.bankAccount.balance.projectedHint' | transloco }}
            </p>
          }
        </div>
      </div>

      <!-- L'écart expliqué + accès au relevé réel -->
      <div
        class="flex flex-col gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        @if (incomplete()) {
          <p class="text-xs text-text-muted" data-testid="upcoming-debits">
            @if (upcomingDebits() > 0) {
              <span class="font-mono font-semibold text-ib-red">
                &minus;{{ upcomingDebits() | number: '1.2-2' }}&euro;
              </span>
              {{ 'budget.bankAccount.balance.upcomingDebitsHint' | transloco }}
            } @else {
              {{ 'budget.bankAccount.balance.noUpcomingDebits' | transloco }}
            }
          </p>
        } @else {
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
        }
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
  /** Total, certain, de ce qui reste à débiter d'ici la fin du mois. */
  readonly upcomingDebits = input(0);
  /** Libellés des revenus à montant variable pas encore saisis ce mois-ci. */
  readonly unknownIncomes = input<readonly string[]>([]);
  /** Le compte n'a ni solde de départ ni opération : le « confirmé » n'a pas de sens. */
  readonly needsStartingBalance = input(false);

  protected readonly incomplete = computed(() => this.unknownIncomes().length > 0);

  protected readonly delta = computed(() => this.projectedBalance() - this.confirmedBalance());
}
