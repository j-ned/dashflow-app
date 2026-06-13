import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-landing-problem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section class="border-y border-border bg-surface" aria-labelledby="problem-title">
      <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <header class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-muted"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-text-muted"></span>
            {{ 'landing.problem.eyebrow' | transloco }}
          </span>
          <h2 id="problem-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.problem.title' | transloco }}
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-text-muted">
            {{ 'landing.problem.lead' | transloco }}
          </p>
        </header>

        <dl class="mt-12 grid gap-x-12 gap-y-10 border-t border-border pt-10 sm:grid-cols-3">
          <div>
            <dt class="text-base font-semibold tracking-tight text-text-primary">
              {{ 'landing.problem.free.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.problem.free.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="text-base font-semibold tracking-tight text-text-primary">
              {{ 'landing.problem.profile.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.problem.profile.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="text-base font-semibold tracking-tight text-text-primary">
              {{ 'landing.problem.readable.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.problem.readable.description' | transloco }}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  `,
})
export class LandingProblem {}
