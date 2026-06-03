import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { PendingCharge } from '../../../domain/pending-charge';

@Component({
  selector: 'app-pending-charges-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (charges().length > 0) {
      <section data-testid="pending-panel" class="rounded-xl border border-ib-orange/40 bg-surface p-4 mb-4">
        <div class="flex items-center justify-between mb-3">
          <p class="text-sm font-semibold">{{ 'budget.bankAccount.pending.title' | transloco }} ({{ charges().length }})</p>
          <button type="button" data-testid="confirm-all"
                  class="text-xs px-2 py-1 rounded-lg bg-ib-orange text-canvas"
                  (click)="confirmAll.emit()">{{ 'budget.bankAccount.pending.confirmAll' | transloco }}</button>
        </div>
        <ul class="divide-y divide-border/40">
          @for (c of charges(); track c.entry.id) {
            <li class="flex items-center justify-between gap-3 py-2">
              <span class="text-sm">{{ c.entry.label }}
                <span class="text-text-muted text-xs">{{ 'budget.bankAccount.pending.dueOn' | transloco: { date: c.suggestedDate } }}</span>
              </span>
              <span class="flex items-center gap-2">
                <input type="number" step="0.01"
                       class="w-24 rounded-lg border border-border bg-canvas px-2 py-1 text-sm text-right"
                       [ngModel]="amounts()[c.entry.id]" (ngModelChange)="setAmount(c.entry.id, $event)" />
                <button type="button" [attr.data-testid]="'confirm-' + c.entry.id"
                        class="text-xs px-2 py-1 rounded-lg bg-ib-green/15 text-ib-green"
                        (click)="confirm.emit({ id: c.entry.id, amount: amounts()[c.entry.id] })">{{ 'budget.bankAccount.pending.confirm' | transloco }}</button>
                <button type="button" [attr.data-testid]="'ignore-' + c.entry.id"
                        class="text-xs px-2 py-1 rounded-lg text-text-muted"
                        (click)="ignore.emit(c.entry.id)">{{ 'budget.bankAccount.pending.ignore' | transloco }}</button>
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
