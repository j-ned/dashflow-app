import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

/** Exports calendrier d'une alerte : lien Google Agenda (si la cible existe encore) et fichier .ics. */
@Component({
  selector: 'app-reminder-calendar-links',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  host: { class: 'flex items-center justify-center gap-1' },
  template: `
    @if (googleUrl(); as url) {
      <a
        [href]="url"
        target="_blank"
        rel="noopener"
        data-testid="reminder-google-link"
        class="inline-flex items-center gap-1 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-blue hover:border-ib-blue/30 transition-colors"
        [title]="'medical.reminder.googleTitle' | transloco"
      >
        <app-icon name="calendar" size="12" />
        {{ 'medical.reminder.google' | transloco }}
      </a>
    }
    <button
      type="button"
      data-testid="reminder-ics-button"
      class="inline-flex items-center gap-1 rounded-lg border border-border min-h-8 px-3 py-1.5 text-xs font-medium text-text-muted hover:text-ib-cyan hover:border-ib-cyan/30 transition-colors"
      [title]="'medical.reminder.icsTitle' | transloco"
      (click)="icsRequested.emit()"
    >
      <app-icon name="download" size="12" /> .ics
    </button>
  `,
})
export class ReminderCalendarLinks {
  readonly googleUrl = input.required<string | null>();
  readonly icsRequested = output<void>();
}
