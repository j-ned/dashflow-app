import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-entry-row-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  host: {
    class: 'flex sm:opacity-0 sm:group-hover:opacity-100 transition-opacity',
    '[class.gap-1]': 'bordered()',
    '[class.gap-0.5]': '!bordered()',
  },
  template: `
    <button
      type="button"
      [class]="editClass()"
      [title]="'budget.bankAccount.incomes.editTitle' | transloco: { label: label() }"
      [attr.aria-label]="'budget.bankAccount.incomes.editAria' | transloco: { label: label() }"
      (click)="edit.emit()"
    >
      <app-icon name="pencil" [size]="iconSize()" />
    </button>
    <button
      type="button"
      [class]="deleteClass()"
      [title]="'budget.bankAccount.incomes.deleteTitle' | transloco: { label: label() }"
      [attr.aria-label]="'budget.bankAccount.incomes.deleteAria' | transloco: { label: label() }"
      (click)="delete.emit()"
    >
      <app-icon name="trash" [size]="iconSize()" />
    </button>
  `,
})
export class EntryRowActions {
  readonly label = input.required<string>();
  readonly variant = input<'bordered' | 'compact'>('bordered');
  readonly edit = output<void>();
  readonly delete = output<void>();

  protected readonly bordered = computed(() => this.variant() === 'bordered');
  protected readonly iconSize = computed(() => (this.bordered() ? 13 : 11));
  protected readonly editClass = computed(() =>
    this.bordered()
      ? 'rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-yellow hover:border-ib-yellow/30 transition-colors'
      : 'rounded p-1 text-text-muted hover:text-ib-yellow transition-colors',
  );
  protected readonly deleteClass = computed(() =>
    this.bordered()
      ? 'rounded-lg border border-border p-1.5 text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors'
      : 'rounded p-1 text-text-muted hover:text-ib-red transition-colors',
  );
}
