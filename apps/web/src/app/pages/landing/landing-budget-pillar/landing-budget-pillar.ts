import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-landing-budget-pillar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section id="budget" class="border-t border-border bg-surface" aria-labelledby="budget-title">
      <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <header class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-green"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-green"></span>
            {{ 'landing.budget.tag' | transloco }}
          </span>
          <h2 id="budget-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.budget.title' | transloco }}
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-text-muted">
            {{ 'landing.budget.subtitle' | transloco }}
          </p>
        </header>

        <dl class="mt-12 grid gap-x-12 gap-y-8 border-t border-border pt-10 sm:grid-cols-2">
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
              {{ 'landing.budget.accounts.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.budget.accounts.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
              {{ 'landing.budget.envelopes.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.budget.envelopes.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
              {{ 'landing.budget.recurrences.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.budget.recurrences.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-green">
              {{ 'landing.budget.loans.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.budget.loans.description' | transloco }}
            </dd>
          </div>
        </dl>

        <figure
          class="mt-12 overflow-hidden rounded-lg border border-border bg-canvas p-2 shadow-2xl shadow-black/40 lg:mt-16"
        >
          <img
            ngSrc="/screen/img.webp"
            [alt]="'landing.budget.screenshotAlt' | transloco"
            class="block h-auto w-full rounded-md"
            loading="lazy"
            height="935"
            width="1908"
          />
        </figure>
      </div>
    </section>
  `,
})
export class LandingBudgetPillar {}
