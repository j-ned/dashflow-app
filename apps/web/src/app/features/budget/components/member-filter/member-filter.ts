import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Member } from '../../domain/models/member.model';
import { MemberDisplay } from '../../domain/member-map';

@Component({
  selector: 'app-member-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'flex flex-wrap items-center gap-2' },
  template: `
    <span class="text-xs font-medium text-text-muted">{{ labelKey() | transloco }}</span>
    <button
      type="button"
      class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
      [class.border-ib-blue]="selected() === null"
      [class.bg-ib-blue]="selected() === null"
      [class.text-canvas]="selected() === null"
      [class.border-border]="selected() !== null"
      [class.text-text-muted]="selected() !== null"
      (click)="selected.set(null)"
    >
      {{ allKey() | transloco }}
    </button>
    @for (m of members(); track m.id) {
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
        [style.border-color]="selected() === m.id ? memberMap().get(m.id)?.color : 'var(--border)'"
        [style.background-color]="
          selected() === m.id ? memberMap().get(m.id)?.color : 'transparent'
        "
        [class.text-canvas]="selected() === m.id"
        [class.text-text-muted]="selected() !== m.id"
        (click)="selected.set(m.id)"
      >
        <span
          class="inline-block h-2.5 w-2.5 rounded-full"
          [style.background-color]="
            selected() === m.id ? 'var(--color-canvas)' : memberMap().get(m.id)?.color
          "
        ></span>
        {{ m.firstName }}
      </button>
    }
  `,
})
export class MemberFilter {
  readonly members = input.required<readonly Member[]>();
  readonly memberMap = input.required<Map<string, MemberDisplay>>();
  readonly labelKey = input.required<string>();
  readonly allKey = input.required<string>();
  readonly selected = model<string | null>(null);
}
