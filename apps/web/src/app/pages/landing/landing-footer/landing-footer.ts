import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-landing-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <footer class="border-t border-border bg-canvas">
      <div
        class="mx-auto flex max-w-6xl flex-col items-start gap-4 px-6 py-10 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="flex items-center gap-2">
          <app-icon name="dashflow-logo" [size]="14" class="text-ib-blue" />
          <span>DashFlow · &copy; {{ currentYear() }}</span>
        </p>
        <p class="flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            [href]="'mailto:' + contactEmail()"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ contactEmail() }}</a
          >
          <a
            routerLink="/legal"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ 'landing.footer.legal' | transloco }}</a
          >
          <a
            routerLink="/auth/login"
            class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >{{ 'landing.footer.login' | transloco }}</a
          >
        </p>
      </div>
    </footer>
  `,
})
export class LandingFooter {
  readonly contactEmail = input.required<string>();
  readonly currentYear = input.required<number>();
}
