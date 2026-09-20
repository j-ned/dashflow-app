import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ReminderTarget } from '../../domain/models/reminder.model';

@Component({
  selector: 'app-reminder-target-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'inline-flex' },
  template: `
    <span
      class="rounded-full px-2 py-0.5 text-xs font-medium"
      [class.bg-ib-orange-10]="isMedication()"
      [class.text-ib-orange]="isMedication()"
      [class.bg-ib-blue-10]="!isMedication()"
      [class.text-ib-blue]="!isMedication()"
    >
      {{
        (isMedication()
          ? 'medical.reminder.targetMedication'
          : 'medical.reminder.targetAppointment'
        ) | transloco
      }}
    </span>
  `,
})
export class ReminderTargetBadge {
  readonly target = input.required<ReminderTarget>();
  protected readonly isMedication = computed(() => this.target() === 'medication');
}
