import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarFooter } from '@shared/components/sidebar-footer/sidebar-footer';
import { Icon, type IconName } from '@shared/components/icon/icon';
import { SidebarStore } from '@core/services/sidebar.store';

type NavItem = {
  readonly route: string;
  readonly icon: IconName;
  readonly label: string;
};

const NAV_ITEMS: NavItem[] = [
  { route: '/medical/dashboard', icon: 'layout-dashboard', label: 'Vue globale' },
  { route: '/medical/patients', icon: 'users', label: 'Patients' },
  { route: '/medical/practitioners', icon: 'stethoscope', label: 'Praticiens' },
  { route: '/medical/appointments', icon: 'calendar', label: 'Rendez-vous' },
  { route: '/medical/prescriptions', icon: 'file-text', label: 'Ordonnances' },
  { route: '/medical/documents', icon: 'folder', label: 'Documents' },
  { route: '/medical/medications', icon: 'pill', label: 'Médicaments' },
  { route: '/medical/reminders', icon: 'bell', label: 'Alertes' },
];

@Component({
  selector: 'app-medical-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SidebarFooter, Icon],
  template: `
    <aside class="sidebar" [class.sidebar--collapsed]="sidebar.collapsed()">

      <!-- Toggle button -->
      <div class="flex items-center px-2 py-3" [class.justify-center]="sidebar.collapsed()" [class.justify-end]="!sidebar.collapsed()">
        <button type="button"
                (click)="sidebar.toggle()"
                class="flex h-7 w-7 items-center justify-center rounded-md text-text-muted hover:bg-hover hover:text-text-primary transition-colors"
                [attr.aria-label]="sidebar.collapsed() ? 'Ouvrir le menu' : 'Réduire le menu'">
          <app-icon [name]="sidebar.collapsed() ? 'chevrons-right' : 'chevrons-left'" size="16" />
        </button>
      </div>

      <!-- Navigation -->
      <nav aria-label="Navigation Medical" class="flex-1 px-2 flex flex-col gap-0.5">
        @for (item of navItems; track item.route) {
          <a [routerLink]="item.route"
             routerLinkActive="nav-link--active"
             class="nav-link"
             [class.nav-link--collapsed]="sidebar.collapsed()"
             [attr.title]="sidebar.collapsed() ? item.label : null">
            <app-icon [name]="item.icon" size="18" class="shrink-0" />
            @if (!sidebar.collapsed()) {
              <span class="truncate">{{ item.label }}</span>
            }
          </a>
        }
      </nav>

      <app-sidebar-footer [collapsed]="sidebar.collapsed()" />
    </aside>

    <section aria-labelledby="medical-content-heading" class="flex-1 flex flex-col overflow-auto bg-canvas p-6">
      <h1 id="medical-content-heading" class="sr-only">Contenu Medical</h1>
      <router-outlet />
    </section>
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
      transition: width 200ms cubic-bezier(0.4, 0, 0.2, 1);
      overflow: hidden;
    }

    .sidebar--collapsed {
      width: 56px;
    }

    .nav-link {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0.75rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--text-muted);
      white-space: nowrap;
      transition: background-color 150ms, color 150ms;
    }

    .nav-link:hover {
      background: var(--bg-hover);
      color: var(--text-primary);
    }

    .nav-link--collapsed {
      justify-content: center;
      padding: 0.5rem;
    }
  `,
})
export class MedicalLayout {
  protected readonly sidebar = inject(SidebarStore);
  protected readonly navItems = NAV_ITEMS;
}
