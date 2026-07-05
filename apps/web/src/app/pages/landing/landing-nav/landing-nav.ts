import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { LocaleThemeToggle } from '@shared/components/locale-theme-toggle/locale-theme-toggle';

@Component({
  selector: 'app-landing-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, LocaleThemeToggle, TranslocoPipe],
  // display:block (pas 'contents') : <nav> sticky en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block', '(document:keydown.escape)': 'closeMenu()' },
  template: `
    <nav
      class="sticky top-0 z-50 border-b border-border bg-canvas"
      [attr.aria-label]="'landing.nav.ariaLabel' | transloco"
    >
      <div class="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a
          routerLink="/"
          class="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          [attr.aria-label]="'landing.nav.logoLabel' | transloco"
          (click)="closeMenu()"
        >
          <app-icon name="dashflow-logo" [size]="22" class="text-ib-blue" />
          <span class="font-mono text-base font-semibold tracking-tight">dashflow</span>
        </a>

        <!-- Desktop : actions en ligne -->
        <div class="hidden items-center gap-2 sm:flex">
          <app-locale-theme-toggle />
          <span class="mx-1 h-5 w-px bg-border" aria-hidden="true"></span>
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

        <!-- Mobile : bouton hamburger -->
        <button
          type="button"
          class="-mr-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:hidden"
          [attr.aria-expanded]="menuOpen()"
          aria-controls="landing-mobile-menu"
          [attr.aria-label]="(menuOpen() ? 'landing.nav.closeMenu' : 'landing.nav.openMenu') | transloco"
          (click)="toggleMenu()"
        >
          @if (menuOpen()) {
            <app-icon name="x" [size]="22" />
          } @else {
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              aria-hidden="true"
            >
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          }
        </button>

        <!-- Mobile : panneau déroulant (overlay, ne pousse pas le contenu) -->
        @if (menuOpen()) {
          <div
            id="landing-mobile-menu"
            class="landing-menu-panel absolute inset-x-0 top-full origin-top border-b border-border bg-canvas shadow-lg sm:hidden"
          >
            <div class="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
              <div
                class="flex items-center justify-between rounded-md border border-border/60 px-3 py-1.5"
              >
                <span class="text-sm text-text-muted">{{
                  'landing.nav.preferences' | transloco
                }}</span>
                <app-locale-theme-toggle />
              </div>
              <a
                routerLink="/auth/login"
                class="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                (click)="closeMenu()"
                >{{ 'landing.nav.login' | transloco }}</a
              >
              <a
                routerLink="/auth/register"
                class="inline-flex min-h-11 items-center justify-center rounded-md bg-ib-blue px-4 py-2 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                (click)="closeMenu()"
                >{{ 'landing.nav.cta' | transloco }}</a
              >
            </div>
          </div>
        }
      </div>
    </nav>

    <!-- Backdrop : ferme au clic hors panneau (mobile) -->
    @if (menuOpen()) {
      <button
        type="button"
        tabindex="-1"
        aria-hidden="true"
        class="fixed inset-0 z-40 cursor-default bg-transparent sm:hidden"
        (click)="closeMenu()"
      ></button>
    }
  `,
  styles: `
    .landing-menu-panel {
      animation: landing-menu-in 180ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    @keyframes landing-menu-in {
      from {
        opacity: 0;
        transform: translateY(-6px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .landing-menu-panel {
        animation: none;
      }
    }
  `,
})
export class LandingNav {
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
