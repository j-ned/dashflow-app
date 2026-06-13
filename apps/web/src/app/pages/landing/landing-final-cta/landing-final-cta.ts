import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-landing-final-cta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section
      class="border-t border-border bg-surface"
      [attr.aria-label]="'landing.finalCta.ariaLabel' | transloco"
    >
      <div class="mx-auto max-w-3xl px-6 py-24 text-center lg:py-32">
        <h2 class="text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ 'landing.finalCta.title' | transloco }}
        </h2>
        <p class="mt-4 text-lg leading-relaxed text-text-muted">
          {{ 'landing.finalCta.subtitle' | transloco }}
        </p>
        <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            routerLink="/auth/register"
            class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-7 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <span>{{ 'landing.finalCta.primaryCta' | transloco }}</span>
            <app-icon name="arrow-right" [size]="16" />
          </a>
          <a
            routerLink="/auth/login"
            class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border bg-canvas px-7 py-3 text-base font-medium text-text-primary transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >{{ 'landing.finalCta.secondaryCta' | transloco }}</a
          >
        </div>
      </div>
    </section>
  `,
})
export class LandingFinalCta {}
