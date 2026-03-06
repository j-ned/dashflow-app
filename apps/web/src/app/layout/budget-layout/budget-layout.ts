import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { SidebarFooter } from '@shared/components/sidebar-footer/sidebar-footer';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-budget-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SidebarFooter, Icon],
  template: `
    <aside class="w-64 h-full border-r border-border bg-surface flex flex-col shrink-0">
      <nav aria-label="Navigation Budget" class="flex-1 p-4 flex flex-col gap-1">
        <a routerLink="/budget/dashboard" routerLinkActive="bg-ib-green/10 text-ib-green" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="layout-dashboard" size="18" /> Vue globale
        </a>
        <a routerLink="/budget/envelopes" routerLinkActive="bg-ib-green/10 text-ib-green" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="mail" size="18" /> Enveloppes
        </a>
        <a routerLink="/budget/loans" routerLinkActive="bg-ib-green/10 text-ib-green" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="banknote" size="18" /> Prêts & Dettes
        </a>
        <a routerLink="/budget/consumables" routerLinkActive="bg-ib-green/10 text-ib-green" class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-hover hover:text-text-primary">
          <app-icon name="package" size="18" /> Consommables
        </a>
      </nav>

      <app-sidebar-footer />
    </aside>

    <section aria-labelledby="budget-content-heading" class="flex-1 flex flex-col overflow-auto bg-canvas p-6">
      <h1 id="budget-content-heading" class="sr-only">Contenu Budget</h1>
      <router-outlet />
    </section>
  `
})
export class BudgetLayout {
}
