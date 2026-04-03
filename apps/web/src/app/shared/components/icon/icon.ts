import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName =
  | 'dashflow-logo'
  | 'wallet' | 'briefcase'
  | 'layout-dashboard' | 'mail' | 'banknote' | 'package'
  | 'trending-up' | 'users' | 'file-text' | 'receipt' | 'landmark'
  | 'settings' | 'log-out' | 'camera' | 'x'
  | 'plus' | 'pencil' | 'trash' | 'search' | 'check'
  | 'alert-triangle' | 'eye' | 'eye-off'
  | 'chevron-down' | 'chevron-up' | 'chevron-right' | 'chevrons-left' | 'chevrons-right' | 'arrow-left'
  | 'arrow-up-right' | 'arrow-down-left'
  | 'calendar' | 'clock' | 'download' | 'filter' | 'shield'
  | 'plus-circle'
  | 'heart-pulse' | 'stethoscope' | 'pill' | 'bell' | 'folder'
  | 'sun' | 'moon'
  | 'chart-line' | 'arrow-right' | 'arrow-left-right' | 'credit-card' | 'activity' | 'heart' | 'monitor'
  | 'shield-check' | 'copy' | 'lock' | 'key';

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" aria-hidden="true">
      <use [attr.href]="'icons/sprite.svg#' + name()"/>
    </svg>
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<number | string>(24);
}