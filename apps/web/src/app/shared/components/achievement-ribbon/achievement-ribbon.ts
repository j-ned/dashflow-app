import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-achievement-ribbon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  template: `
    <span
      class="pointer-events-none absolute right-0 top-0 h-16 w-16 overflow-hidden"
      data-testid="achievement-ribbon"
      [attr.aria-label]="label()"
    >
      <span
        class="absolute right-[-38px] top-[14px] w-[130px] rotate-45 bg-ib-green py-1 text-center text-[10px] font-bold uppercase tracking-wider text-canvas shadow-md"
      >
        {{ label() }}
      </span>
    </span>
  `,
})
export class AchievementRibbon {
  readonly label = input.required<string>();
}
