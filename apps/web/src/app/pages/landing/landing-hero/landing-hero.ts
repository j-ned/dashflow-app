import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-landing-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgOptimizedImage, Icon, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section
      class="mx-auto max-w-6xl px-6 pt-16 pb-16 lg:pt-24 lg:pb-20"
      aria-labelledby="hero-title"
    >
      <div class="mx-auto max-w-3xl text-center">
        <span
          class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-blue"
        >
          <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-blue"></span>
          {{ 'landing.hero.eyebrow' | transloco }}
        </span>
        <h1
          id="hero-title"
          class="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.75rem]"
        >
          {{ 'landing.hero.titleLine1' | transloco }}<br />
          <span class="text-ib-blue">{{ 'landing.hero.titleLine2' | transloco }}</span>
        </h1>
        <p class="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-text-muted">
          {{ 'landing.hero.subtitle' | transloco }}
        </p>

        <div class="mt-10 flex flex-wrap items-center justify-center gap-4">
          <a
            routerLink="/auth/register"
            class="inline-flex min-h-12 items-center gap-2 rounded-md bg-ib-blue px-6 py-3 text-base font-semibold text-canvas transition-colors hover:bg-ib-blue/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <span>{{ 'landing.hero.primaryCta' | transloco }}</span>
            <app-icon name="arrow-right" [size]="16" />
          </a>
          <a
            href="#pricing"
            class="inline-flex min-h-12 items-center gap-2 rounded-md border border-border px-6 py-3 text-base font-medium text-text-primary transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >{{ 'landing.hero.secondaryCta' | transloco }}</a
          >
        </div>

        <button
          type="button"
          (click)="startDemo.emit()"
          [disabled]="demoLoading()"
          class="mt-5 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-ib-blue transition-colors hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
        >
          {{ (demoLoading() ? 'landing.hero.demoLoading' : 'landing.hero.demoCta') | transloco }}
          <app-icon name="arrow-right" [size]="14" />
        </button>

        <p class="mt-6 flex items-center justify-center gap-2 text-sm text-text-muted">
          <app-icon name="lock" [size]="14" class="text-ib-blue" />
          <span>{{ 'landing.hero.reassurance' | transloco }}</span>
        </p>
      </div>

      <figure
        class="mt-14 overflow-hidden rounded-lg border border-border bg-surface p-2 shadow-2xl shadow-black/40 lg:mt-16"
      >
        <img
          ngSrc="/screen/img_9.webp"
          [alt]="'landing.hero.screenshotAlt' | transloco"
          class="block h-auto w-full rounded-md"
          priority
          height="935"
          width="1908"
        />
        <figcaption class="px-2 pt-2.5 pb-1 font-mono text-xs text-text-muted">
          {{ 'landing.hero.screenshotCaption' | transloco }}
        </figcaption>
      </figure>
    </section>
  `,
})
export class LandingHero {
  readonly demoLoading = input.required<boolean>();
  readonly startDemo = output<void>();
}
