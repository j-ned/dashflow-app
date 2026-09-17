import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

const ICON_BUTTON =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-muted transition-colors focus-visible:outline-none focus-visible:ring-2';

/**
 * Actions d'un rendez-vous. Seule l'action attendue (« Compléter ») garde son libellé ; les autres
 * sont des boutons icône nommés par `aria-label`, pour ne pas aligner quatre boutons texte par ligne.
 */
@Component({
  selector: 'app-appointment-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  host: { class: 'flex items-center justify-end gap-1' },
  template: `
    @if (scheduled()) {
      <button
        type="button"
        data-testid="appointment-complete"
        class="inline-flex min-h-8 items-center gap-1 rounded-lg border border-ib-green/30 bg-ib-green/5 px-3 py-1.5 text-xs font-medium text-ib-green transition-colors hover:bg-ib-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-green"
        (click)="completed.emit()"
      >
        <app-icon name="check" size="14" /> {{ 'medical.appointment.complete' | transloco }}
      </button>
      <button
        type="button"
        data-testid="appointment-cancel"
        [class]="
          iconButton +
          ' hover:border-ib-yellow/30 hover:text-ib-yellow focus-visible:ring-ib-yellow'
        "
        [attr.aria-label]="'medical.appointment.cancel' | transloco"
        [title]="'medical.appointment.cancel' | transloco"
        (click)="cancelled.emit()"
      >
        <app-icon name="x" size="14" />
      </button>
    }
    <button
      type="button"
      data-testid="appointment-edit"
      [class]="
        iconButton + ' hover:border-ib-blue/30 hover:text-ib-blue focus-visible:ring-ib-blue'
      "
      [attr.aria-label]="'medical.appointment.edit' | transloco"
      [title]="'medical.appointment.edit' | transloco"
      (click)="edited.emit()"
    >
      <app-icon name="pencil" size="14" />
    </button>
    <button
      type="button"
      data-testid="appointment-delete"
      [class]="iconButton + ' hover:border-ib-red/30 hover:text-ib-red focus-visible:ring-ib-red'"
      [attr.aria-label]="'medical.appointment.delete' | transloco"
      [title]="'medical.appointment.delete' | transloco"
      (click)="deleted.emit()"
    >
      <app-icon name="trash" size="14" />
    </button>
  `,
})
export class AppointmentActions {
  readonly scheduled = input.required<boolean>();

  readonly completed = output<void>();
  readonly cancelled = output<void>();
  readonly edited = output<void>();
  readonly deleted = output<void>();

  protected readonly iconButton = ICON_BUTTON;
}
