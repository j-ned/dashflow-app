import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-reminder-delete-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      data-testid="reminder-delete-button"
      class="rounded-lg border border-border px-3 py-1.5 text-xs min-h-8 font-medium text-text-muted hover:text-ib-red hover:border-ib-red/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-red"
      (click)="deleteRequested.emit()"
    >
      {{ 'medical.reminder.delete' | transloco }}
    </button>
  `,
})
export class ReminderDeleteButton {
  readonly deleteRequested = output<void>();
}
