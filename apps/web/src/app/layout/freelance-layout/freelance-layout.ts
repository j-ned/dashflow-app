import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarFooter } from '@shared/components/sidebar-footer/sidebar-footer';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-freelance-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SidebarFooter, Icon],
  template: `
    <aside class="w-64 h-full border-r border-border bg-surface flex flex-col shrink-0">
      <nav aria-label="Navigation Freelance" class="flex-1 p-4 flex flex-col gap-1">
        <a routerLink="/freelance/dashboard" routerLinkActive="bg-ib-blue/10 text-ib-blue" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="trending-up" size="18" /> Tableau de bord
        </a>
        <a routerLink="/freelance/clients" routerLinkActive="bg-ib-blue/10 text-ib-blue" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="users" size="18" /> Clients
        </a>
        <a routerLink="/freelance/quotes" routerLinkActive="bg-ib-blue/10 text-ib-blue" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="file-text" size="18" /> Devis
        </a>
        <a routerLink="/freelance/invoices" routerLinkActive="bg-ib-blue/10 text-ib-blue" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="receipt" size="18" /> Factures
        </a>
        <a routerLink="/freelance/fiscal" routerLinkActive="bg-ib-blue/10 text-ib-blue" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="landmark" size="18" /> Impôts & URSSAF
        </a>
      </nav>

      <app-sidebar-footer />
    </aside>

    <section aria-labelledby="freelance-content-heading" class="flex-1 flex flex-col overflow-auto bg-canvas p-6">
      <h1 id="freelance-content-heading" class="sr-only">Contenu Freelance</h1>
      <router-outlet />
    </section>
  `
})
export class FreelanceLayout {
}
