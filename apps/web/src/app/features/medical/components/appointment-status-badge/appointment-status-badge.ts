import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppointmentStatus } from '../../domain/models/appointment.model';

const STATUS_CLASSES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-ib-blue-15 text-ib-blue',
  completed: 'bg-ib-green-15 text-ib-green',
  cancelled: 'bg-hover text-text-muted',
  no_show: 'bg-ib-red-15 text-ib-red',
};

@Component({
  selector: 'app-appointment-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'inline-flex' },
  template: `
    <span [class]="classes()">{{ 'medical.appointment.statuses.' + status() | transloco }}</span>
  `,
})
export class AppointmentStatusBadge {
  readonly status = input.required<AppointmentStatus>();

  protected readonly classes = computed(
    () =>
      `inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[this.status()]}`,
  );
}
