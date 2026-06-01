import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-month-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  host: { class: 'flex items-center gap-0.5 ml-1' },
  template: `
    <button
      type="button"
      class="rounded p-0.5 text-text-muted transition-colors"
      [class]="accentHover()"
      [attr.aria-label]="'budget.bankAccount.expenses.prevMonth' | transloco"
      (click)="prev.emit()"
    >
      <app-icon name="chevron-right" size="12" class="rotate-180" />
    </button>
    <span class="text-[11px] font-medium text-text-primary min-w-20 text-center">{{ label() }}</span>
    <button
      type="button"
      class="rounded p-0.5 text-text-muted transition-colors"
      [class]="accentHover()"
      [attr.aria-label]="'budget.bankAccount.expenses.nextMonth' | transloco"
      (click)="next.emit()"
    >
      <app-icon name="chevron-right" size="12" />
    </button>
  `,
})
export class MonthNav {
  readonly label = input.required<string>();
  readonly accentHover = input.required<string>();
  readonly prev = output<void>();
  readonly next = output<void>();
}
