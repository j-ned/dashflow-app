import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { RecurringEntry } from '../../../domain/models/recurring-entry.model';
import { BankAccount } from '../../../domain/models/bank-account.model';

@Component({
  selector: 'app-orphan-entries-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'block' },
  template: `
    @if (entries().length > 0) {
      <section
        data-testid="orphan-panel"
        class="rounded-xl border border-ib-red/40 bg-surface p-4 mb-4"
      >
        <p class="text-sm font-semibold mb-3">
          {{ 'budget.bankAccount.orphans.title' | transloco }} ({{ entries().length }})
        </p>
        <ul class="divide-y divide-border/40">
          @for (e of entries(); track e.id) {
            <li class="flex items-center justify-between gap-3 py-2">
              <span class="text-sm">{{ e.label }}</span>
              <span class="flex items-center gap-2">
                <select
                  [attr.data-testid]="'orphan-account-' + e.id"
                  class="rounded-lg border border-border bg-canvas px-2 py-1 text-sm"
                  (change)="reassign.emit({ id: e.id, accountId: selectValue($event) })"
                >
                  <option value="" disabled selected>
                    {{ 'budget.bankAccount.orphans.reassignPlaceholder' | transloco }}
                  </option>
                  @for (a of accounts(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
                <button
                  type="button"
                  [attr.data-testid]="'delete-orphan-' + e.id"
                  class="text-xs px-2 py-1 rounded-lg text-ib-red"
                  (click)="delete.emit(e.id)"
                >
                  {{ 'budget.bankAccount.orphans.delete' | transloco }}
                </button>
              </span>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class OrphanEntriesPanel {
  readonly entries = input.required<RecurringEntry[]>();
  readonly accounts = input.required<BankAccount[]>();
  readonly reassign = output<{ id: string; accountId: string }>();
  readonly delete = output<string>();

  protected selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }
}
