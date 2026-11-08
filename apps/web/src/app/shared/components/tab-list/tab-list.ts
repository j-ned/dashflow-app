import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  viewChildren,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** `labelKey` est une clé i18n, traduite au rendu par le pipe (jamais dans un `computed`). */
export type TabItem = { readonly id: string; readonly labelKey: string };

/**
 * Liste d'onglets (motif ARIA « tabs », activation automatique). Le parent rend les panneaux avec
 * `id="{idPrefix}-panel-{id}"`, `role="tabpanel"` et `aria-labelledby="{idPrefix}-tab-{id}"`.
 */
@Component({
  selector: 'app-tab-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'block' },
  template: `
    <div
      role="tablist"
      class="flex gap-1 overflow-x-auto border-b border-border"
      [attr.aria-label]="label()"
    >
      @for (tab of tabs(); track tab.id) {
        @let active = tab.id === selected();
        <button
          #tabButton
          type="button"
          role="tab"
          class="-mb-px shrink-0 whitespace-nowrap border-b-2 min-h-10 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          [class.border-ib-blue]="active"
          [class.text-text-primary]="active"
          [class.border-transparent]="!active"
          [class.text-text-muted]="!active"
          [id]="idPrefix() + '-tab-' + tab.id"
          [attr.aria-controls]="idPrefix() + '-panel-' + tab.id"
          [attr.aria-selected]="active"
          [tabIndex]="active ? 0 : -1"
          (click)="selected.set(tab.id)"
          (keydown)="moveWithKeyboard($event)"
        >
          {{ tab.labelKey | transloco }}
        </button>
      }
    </div>
  `,
})
export class TabList {
  readonly tabs = input.required<readonly TabItem[]>();
  /** Nom accessible de la liste d'onglets. */
  readonly label = input.required<string>();
  readonly idPrefix = input.required<string>();
  readonly selected = model.required<string>();

  private readonly _buttons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  protected moveWithKeyboard(event: KeyboardEvent): void {
    const tabs = this.tabs();
    const current = tabs.findIndex((t) => t.id === this.selected());
    const target = targetIndex(event.key, current, tabs.length);
    if (target === null) return;
    event.preventDefault();
    const tab = tabs[target];
    if (!tab) return;
    this.selected.set(tab.id);
    this._buttons()[target]?.nativeElement.focus();
  }
}

function targetIndex(key: string, current: number, count: number): number | null {
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
