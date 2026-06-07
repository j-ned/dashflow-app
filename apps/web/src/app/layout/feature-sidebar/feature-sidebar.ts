import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SidebarFooter } from '@shared/components/sidebar-footer/sidebar-footer';
import { Icon, type IconName } from '@shared/components/icon/icon';
import { SidebarStore } from '@core/services/sidebar.store';

export type FeatureSidebarItem = {
  readonly route: string;
  readonly icon: IconName;
  readonly labelKey: string;
};

@Component({
  selector: 'app-feature-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'contents' },
  imports: [RouterLink, RouterLinkActive, SidebarFooter, Icon, TranslocoPipe],
  template: `
    <aside class="sidebar" [class.sidebar--collapsed]="sidebar.collapsed()">
      <div
        class="flex items-center px-2 py-3"
        [class.justify-center]="sidebar.collapsed()"
        [class.justify-end]="!sidebar.collapsed()"
      >
        <button
          type="button"
          (click)="sidebar.toggle()"
          class="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-hover hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          [attr.aria-label]="
            (sidebar.collapsed() ? 'layout.sidebar.expand' : 'layout.sidebar.collapse') | transloco
          "
          [attr.aria-expanded]="!sidebar.collapsed()"
        >
          <app-icon [name]="sidebar.collapsed() ? 'chevrons-right' : 'chevrons-left'" size="16" />
        </button>
      </div>

      <nav [attr.aria-label]="navLabelKey() | transloco" class="flex-1 px-2 flex flex-col gap-0.5">
        @for (item of items(); track item.route) {
          <a
            [routerLink]="item.route"
            routerLinkActive="nav-link--active"
            class="nav-link"
            [class.nav-link--collapsed]="sidebar.collapsed()"
            [attr.title]="sidebar.collapsed() ? (item.labelKey | transloco) : null"
          >
            <app-icon [name]="item.icon" size="18" class="shrink-0" />
            @if (!sidebar.collapsed()) {
              <span class="truncate">{{ item.labelKey | transloco }}</span>
            }
          </a>
        }
      </nav>

      <app-sidebar-footer [collapsed]="sidebar.collapsed()" />
    </aside>
  `,
  styles: `
    .sidebar {
      width: 256px;
      height: 100%;
      border-right: 1px solid var(--border);
      background: var(--bg-surface);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      overflow: hidden;
      will-change: width;
      transition: width 180ms ease-out;
      contain: layout style;
    }

    .sidebar--collapsed {
      width: 56px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.75rem;
      min-height: 44px;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      white-space: nowrap;
      transition:
        background-color 150ms,
        color 150ms;
    }

    .nav-link:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .nav-link:focus-visible {
      outline: 2px solid var(--color-ib-blue);
      outline-offset: -2px;
    }

    .nav-link--active {
      background: var(--color-ib-blue-10);
      color: var(--color-ib-blue);
    }

    .nav-link--collapsed {
      justify-content: center;
      padding: 0.625rem;
    }
  `,
})
export class FeatureSidebar {
  readonly items = input.required<readonly FeatureSidebarItem[]>();
  readonly navLabelKey = input.required<string>();

  protected readonly sidebar = inject(SidebarStore);
}
