import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { balanceGap } from '../../../domain/balance-check';

/**
 * « Vérifier avec ma banque » : l'utilisateur saisit le solde affiché par sa banque, l'appli montre
 * l'écart avec son propre calcul et propose de le rattraper. C'est le garde-fou du pointage
 * automatique : un seul chiffre par mois au lieu de pointer chaque prélèvement.
 */
@Component({
  selector: 'app-balance-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslocoPipe],
  host: { class: 'block mt-3' },
  template: `
    @if (!open()) {
      <button
        type="button"
        data-testid="balance-check-open"
        class="inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium transition-colors"
        [class]="
          due()
            ? 'border-ib-orange/40 bg-ib-orange/10 text-ib-orange hover:bg-ib-orange/15'
            : 'border-border text-text-muted hover:text-text-primary'
        "
        (click)="open.set(true)"
      >
        {{ 'budget.bankAccount.check.open' | transloco }}
      </button>
      <p class="mt-1.5 text-[11px] text-text-muted" data-testid="balance-check-last">
        @if (checkedAt(); as at) {
          {{ 'budget.bankAccount.check.lastChecked' | transloco: { date: (at | date: 'd MMM') } }}
        } @else {
          {{ 'budget.bankAccount.check.neverChecked' | transloco }}
        }
      </p>
    } @else {
      <form
        class="rounded-md border border-border bg-canvas p-3"
        data-testid="balance-check-form"
        (ngSubmit)="submitCheck()"
      >
        <label class="block text-xs font-medium text-text-primary" for="balance-check-real">
          {{ 'budget.bankAccount.check.label' | transloco }}
        </label>
        <div class="mt-1.5 flex flex-wrap items-center gap-2">
          <span class="relative">
            <input
              id="balance-check-real"
              name="realBalance"
              type="number"
              step="0.01"
              data-testid="balance-check-input"
              class="w-36 rounded-md border border-border bg-surface py-1.5 pl-2 pr-6 text-right font-mono text-sm text-text-primary"
              [ngModel]="realBalance()"
              (ngModelChange)="realBalance.set($event)"
            />
            <span
              class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted"
              aria-hidden="true"
              >&euro;</span
            >
          </span>
          <button
            type="submit"
            data-testid="balance-check-submit"
            class="min-h-8 rounded-md bg-ib-blue px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            [disabled]="gap() === null || busy()"
          >
            {{
              (gap() === 0
                ? 'budget.bankAccount.check.confirmMatch'
                : 'budget.bankAccount.check.adjust'
              ) | transloco
            }}
          </button>
          <button
            type="button"
            class="min-h-8 rounded-md px-2 text-xs text-text-muted transition-colors hover:text-text-primary"
            (click)="closeForm()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
        </div>

        <p class="mt-2 text-xs" role="status" data-testid="balance-check-gap">
          @if (gap(); as g) {
            <span
              class="font-mono font-semibold"
              [class.text-ib-green]="g > 0"
              [class.text-ib-red]="g < 0"
              >{{ g > 0 ? '+' : '−' }}{{ absGap() | number: '1.2-2' }}&euro;</span
            >
            <span class="text-text-muted">
              {{
                (g > 0 ? 'budget.bankAccount.check.gapMore' : 'budget.bankAccount.check.gapLess')
                  | transloco
              }}
            </span>
          } @else if (gap() === 0) {
            <span class="font-medium text-ib-green">{{
              'budget.bankAccount.check.match' | transloco
            }}</span>
          } @else {
            <span class="text-text-muted">{{ 'budget.bankAccount.check.help' | transloco }}</span>
          }
        </p>
      </form>
    }
  `,
})
export class BalanceCheck {
  readonly confirmedBalance = input.required<number>();
  /** Horodatage de la dernière vérification sur cet appareil, ou `null`. */
  readonly checkedAt = input<number | null>(null);
  /** La dernière vérification date : le bouton se met en avant. */
  readonly due = input(false);
  readonly busy = input(false);

  /** Solde réel saisi, quand l'utilisateur valide (écart nul compris : ça compte comme vérifié). */
  readonly checked = output<number>();

  protected readonly open = signal(false);
  protected readonly realBalance = signal<number | null>(null);

  protected readonly gap = computed(() => {
    const real = this.realBalance();
    return typeof real === 'number' && Number.isFinite(real)
      ? balanceGap(this.confirmedBalance(), real)
      : null;
  });
  protected readonly absGap = computed(() => Math.abs(this.gap() ?? 0));

  protected submitCheck(): void {
    const real = this.realBalance();
    if (this.gap() === null || typeof real !== 'number') return;
    this.checked.emit(real);
    this.closeForm();
  }

  protected closeForm(): void {
    this.open.set(false);
    this.realBalance.set(null);
  }
}
