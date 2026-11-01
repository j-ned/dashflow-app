import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { LocaleThemeToggle } from '@shared/components/locale-theme-toggle/locale-theme-toggle';

const CONTACT_EMAIL = 'contact@nedellec-julien.fr';

@Component({
  selector: 'app-legal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe, Icon, LocaleThemeToggle],
  host: { class: 'block min-h-screen bg-canvas text-text-primary selection:bg-ib-blue/25' },
  template: `
    <nav
      class="sticky top-0 z-50 border-b border-border bg-canvas"
      [attr.aria-label]="'legal.navAriaLabel' | transloco"
    >
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
        <a
          routerLink="/"
          class="inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          [attr.aria-label]="'legal.home' | transloco"
        >
          <app-icon name="dashflow-logo" [size]="22" class="text-ib-blue" />
          <span class="font-mono text-base font-semibold tracking-tight">dashflow</span>
        </a>
        <div class="flex items-center gap-1 sm:gap-2">
          <app-locale-theme-toggle />
          <span class="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true"></span>
          <a
            routerLink="/"
            class="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >{{ 'legal.back' | transloco }}</a
          >
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-3xl px-6 py-16 lg:py-24">
      <header>
        <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ 'legal.title' | transloco }}
        </h1>
        <p class="mt-3 font-mono text-xs uppercase tracking-[0.16em] text-text-muted">
          {{ 'legal.updated' | transloco }}
        </p>
      </header>

      <div class="mt-12 space-y-12 border-t border-border pt-12">
        <section aria-labelledby="legal-editor">
          <h2 id="legal-editor" class="text-xl font-semibold tracking-tight">
            {{ 'legal.editor.title' | transloco }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ 'legal.editor.body' | transloco }}
          </p>
        </section>
        <section aria-labelledby="legal-hosting">
          <h2 id="legal-hosting" class="text-xl font-semibold tracking-tight">
            {{ 'legal.hosting.title' | transloco }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ 'legal.hosting.body' | transloco }}
          </p>
        </section>
        <section aria-labelledby="legal-ip">
          <h2 id="legal-ip" class="text-xl font-semibold tracking-tight">
            {{ 'legal.ip.title' | transloco }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ 'legal.ip.body' | transloco }}
          </p>
        </section>
        <section aria-labelledby="legal-data">
          <h2 id="legal-data" class="text-xl font-semibold tracking-tight">
            {{ 'legal.data.title' | transloco }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ 'legal.data.body' | transloco }}
          </p>
        </section>
        <section aria-labelledby="legal-cookies">
          <h2 id="legal-cookies" class="text-xl font-semibold tracking-tight">
            {{ 'legal.cookies.title' | transloco }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ 'legal.cookies.body' | transloco }}
          </p>
        </section>
        <section aria-labelledby="legal-contact">
          <h2 id="legal-contact" class="text-xl font-semibold tracking-tight">
            {{ 'legal.contact.title' | transloco }}
          </h2>
          <p class="mt-3 text-base leading-relaxed text-text-muted">
            {{ 'legal.contact.body' | transloco }}
            <a
              [href]="'mailto:' + contactEmail"
              class="rounded-sm text-ib-blue transition-colors hover:text-ib-blue/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
              >{{ contactEmail }}</a
            >
          </p>
        </section>
      </div>
    </main>

    <footer class="border-t border-border">
      <div
        class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-8 text-sm text-text-muted"
      >
        <span>DashFlow &middot; &copy; {{ currentYear }}</span>
        <a
          routerLink="/"
          class="rounded-sm transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
          >{{ 'legal.back' | transloco }}</a
        >
      </div>
    </footer>
  `,
})
export class LegalComponent {
  protected readonly contactEmail = CONTACT_EMAIL;
  protected readonly currentYear = new Date().getFullYear();
}
