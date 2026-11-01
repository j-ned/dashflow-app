import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Interrupteur accessible (`role="switch"`). Le parent porte l'état : un clic émet `toggled`. */
@Component({
  selector: 'app-toggle-switch',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex' },
  template: `
    <button
      type="button"
      role="switch"
      class="relative inline-flex h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-purple"
      [class.bg-ib-purple]="checked()"
      [class.bg-hover]="!checked()"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      (click)="toggled.emit()"
    >
      <span
        class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform mt-0.5"
        [class.translate-x-4]="checked()"
        [class.translate-x-0.5]="!checked()"
      ></span>
    </button>
  `,
})
export class ToggleSwitch {
  readonly checked = input.required<boolean>();
  /** Nom accessible : un interrupteur sans libellé est muet pour un lecteur d'écran. */
  readonly label = input.required<string>();
  readonly toggled = output<void>();
}
