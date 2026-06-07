import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { PendingCharge } from '../../../domain/pending-charge';

/**
 * Prélèvements récurrents dont la date prévue est passée : à rapprocher du
 * relevé réel. "Débité" matérialise la transaction (passe au solde confirmé),
 * "Pas débité" l'écarte. L'explication est rendue explicite dans l'UI.
 */
@Component({
  selector: 'app-pending-charges-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (charges().length > 0) {
      <section
        data-testid="pending-panel"
        class="mb-4 rounded-lg border border-ib-orange/40 bg-surface p-4"
      >
        <div class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div class="min-w-0">
            <p class="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <span
                class="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-ib-orange/15 px-1 font-mono text-xs text-ib-orange"
                >{{ charges().length }}</span
              >
              {{ 'budget.bankAccount.pending.title' | transloco }}
            </p>
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
          @for (c of charges(); track c.entry.id) {
            <li class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2.5">
              <span class="min-w-0 text-sm text-text-primary">
                {{ c.entry.label }}
                <span class="text-xs text-text-muted"
                  >&middot;
                  {{
                    'budget.bankAccount.pending.dueOn' | transloco: { date: c.suggestedDate }
                  }}</span
                >
              </span>
              <span class="flex items-center gap-2">
                <span class="relative">
                  <input
                    type="number"
                    step="0.01"
                    class="w-28 rounded-md border border-border bg-canvas py-1 pl-2 pr-6 text-right font-mono text-sm text-text-primary"
                    [attr.aria-label]="
                      'budget.bankAccount.pending.amountAria' | transloco: { label: c.entry.label }
                    "
                    [ngModel]="amounts()[c.entry.id]"
                    (ngModelChange)="setAmount(c.entry.id, $event)"
                  />
                  <span
                    class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-text-muted"
                    aria-hidden="true"
                    >&euro;</span
                  >
                </span>
                <button
                  type="button"
                  [attr.data-testid]="'confirm-' + c.entry.id"
                  class="rounded-md bg-ib-green/15 px-2.5 py-1 text-xs font-medium text-ib-green transition-colors hover:bg-ib-green/25"
                  (click)="confirm.emit({ id: c.entry.id, amount: amounts()[c.entry.id] })"
                >
                  {{ 'budget.bankAccount.pending.confirm' | transloco }}
                </button>
                <button
                  type="button"
                  [attr.data-testid]="'ignore-' + c.entry.id"
                  class="rounded-md px-2.5 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
                  (click)="ignore.emit(c.entry.id)"
                >
                  {{ 'budget.bankAccount.pending.ignore' | transloco }}
                </button>
              </span>
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
  readonly confirmAll = output<void>();
  readonly ignore = output<string>();

  protected readonly amounts = linkedSignal<Record<string, number>>(() =>
    Object.fromEntries(this.charges().map((c) => [c.entry.id, c.suggestedAmount])),
  );

  protected setAmount(id: string, value: number): void {
    this.amounts.update((m) => ({ ...m, [id]: value }));
  }
}
