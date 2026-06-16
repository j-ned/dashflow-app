import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FeatureSidebar, type FeatureSidebarItem } from '../feature-sidebar/feature-sidebar';

const BUDGET_NAV: readonly FeatureSidebarItem[] = [
  { route: '/budget/dashboard', icon: 'layout-dashboard', labelKey: 'layout.budget.dashboard' },
  { route: '/budget/envelopes', icon: 'mail', labelKey: 'layout.budget.envelopes' },
  { route: '/budget/loans', icon: 'banknote', labelKey: 'layout.budget.loans' },
  { route: '/budget/account', icon: 'wallet', labelKey: 'layout.budget.account' },
  { route: '/budget/archives', icon: 'folder', labelKey: 'layout.budget.archives' },
  { route: '/budget/analytics', icon: 'trending-up', labelKey: 'layout.budget.analytics' },
  { route: '/budget/transactions', icon: 'receipt', labelKey: 'layout.budget.transactions' },
];

@Component({
  selector: 'app-budget-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, FeatureSidebar, TranslocoPipe],
  template: `
    <app-feature-sidebar [items]="navItems" navLabelKey="layout.budget.navLabel" />

    <section
      aria-labelledby="budget-content-heading"
      class="flex-1 flex flex-col overflow-auto bg-canvas p-6"
    >
      <h1 id="budget-content-heading" class="sr-only">
        {{ 'layout.budget.contentHeading' | transloco }}
      </h1>
      <router-outlet />
    </section>
  `,
})
export class BudgetLayout {
  protected readonly navItems = BUDGET_NAV;
}
