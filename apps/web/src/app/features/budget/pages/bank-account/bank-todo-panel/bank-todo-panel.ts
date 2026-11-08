import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

/**
 * Regroupe tout ce qui attend un geste (échéances à confirmer, revenus à saisir, opérations sans
 * compte) derrière une seule ligne repliable : la page s'ouvre sur le solde, pas sur une liste.
 */
@Component({
  selector: 'app-bank-todo-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, Icon],
  host: { class: 'block' },
  template: `
    @if (count() > 0) {
      <details
        class="group rounded-xl border border-ib-orange/40 bg-surface"
        [open]="open()"
        (toggle)="syncOpen($event)"
      >
        <summary
          class="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-orange [&::-webkit-details-marker]:hidden"
        >
          <span
            class="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-ib-orange/15 px-1.5 font-mono text-xs font-semibold text-ib-orange"
            >{{ count() }}</span
          >
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-text-primary">
              {{ 'budget.bankAccount.todo.title' | transloco }}
            </span>
            <span class="block text-xs text-text-muted">
              {{ 'budget.bankAccount.todo.hint' | transloco }}
            </span>
          </span>
          <app-icon
            name="chevron-down"
            size="16"
            class="shrink-0 text-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div class="border-t border-border/50 px-4 pt-4">
          <ng-content />
        </div>
      </details>
    }
  `,
})
export class BankTodoPanel {
  /** Nombre d'éléments en attente d'un geste. Zéro : le bloc n'existe pas. */
  readonly count = input.required<number>();
  /** Le parent le déplie quand il y envoie l'utilisateur (ex. « Saisir le revenu reçu »). */
  readonly open = model(false);

  protected syncOpen(event: Event): void {
    if (event.target instanceof HTMLDetailsElement) this.open.set(event.target.open);
  }
}
