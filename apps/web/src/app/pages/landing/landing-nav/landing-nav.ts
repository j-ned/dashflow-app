import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { LocaleThemeToggle } from '@shared/components/locale-theme-toggle/locale-theme-toggle';

@Component({
  selector: 'app-landing-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, LocaleThemeToggle, TranslocoPipe],
  // display:block (pas 'contents') : <nav> sticky en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <nav
      class="sticky top-0 z-50 border-b border-border bg-canvas"
      [attr.aria-label]="'landing.nav.ariaLabel' | transloco"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a
          routerLink="/"
          class="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          [attr.aria-label]="'landing.nav.logoLabel' | transloco"
        >
          <app-icon name="dashflow-logo" [size]="22" class="text-ib-blue" />
          <span class="font-mono text-base font-semibold tracking-tight">dashflow</span>
        </a>

        <div class="flex items-center gap-1 sm:gap-2">
          <app-locale-theme-toggle />
          <span class="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span>
          <a
            routerLink="/auth/login"
            class="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >{{ 'landing.nav.login' | transloco }}</a
          >
          <a
            routerLink="/auth/register"
            class="inline-flex min-h-11 items-center rounded-md bg-ib-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >{{ 'landing.nav.cta' | transloco }}</a
          >
        </div>
      </div>
    </nav>
  `,
})
export class LandingNav {}
