import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeatureSidebar, type FeatureSidebarItem } from '../feature-sidebar/feature-sidebar';

const BUDGET_NAV: readonly FeatureSidebarItem[] = [
  { route: '/budget/dashboard', icon: 'layout-dashboard', label: 'Vue globale' },
  { route: '/budget/envelopes', icon: 'mail', label: 'Enveloppes' },
  { route: '/budget/loans', icon: 'banknote', label: 'Prêts & Dettes' },
  { route: '/budget/account', icon: 'wallet', label: 'Compte' },
  { route: '/budget/archives', icon: 'folder', label: 'Archives' },
  { route: '/budget/analytics', icon: 'trending-up', label: 'Statistiques' },
];

@Component({
  selector: 'app-budget-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, FeatureSidebar],
  template: `
    <app-feature-sidebar [items]="navItems" navLabel="Navigation Budget" />

    <section
      aria-labelledby="budget-content-heading"
      class="flex-1 flex flex-col overflow-auto bg-canvas p-6"
    >
      <h1 id="budget-content-heading" class="sr-only">Contenu Budget</h1>
      <router-outlet />
    </section>
  `,
})
export class BudgetLayout {
  protected readonly navItems = BUDGET_NAV;
}
