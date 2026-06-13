import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-landing-security',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section
      id="security"
      class="mx-auto max-w-6xl px-6 py-24 lg:py-32"
      aria-labelledby="how-title"
    >
      <header class="max-w-3xl">
        <span
          class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-blue"
        >
          <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-blue"></span>
          {{ 'landing.how.eyebrow' | transloco }}
        </span>
        <h2 id="how-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ 'landing.how.title' | transloco }}
        </h2>
        <p class="mt-4 text-lg leading-relaxed text-text-muted">
          {{ 'landing.how.subtitle' | transloco }}
        </p>
      </header>

      <ol class="mt-12 grid gap-x-10 gap-y-10 border-t border-border pt-10 sm:grid-cols-3">
        <li>
          <span class="font-mono text-sm text-ib-blue">01</span>
          <h3 class="mt-3 text-xl font-semibold tracking-tight">
            {{ 'landing.how.step1.title' | transloco }}
          </h3>
          <p class="mt-2 text-base leading-relaxed text-text-muted">
            {{ 'landing.how.step1.body' | transloco }}
          </p>
        </li>
        <li>
          <span class="font-mono text-sm text-ib-blue">02</span>
          <h3 class="mt-3 text-xl font-semibold tracking-tight">
            {{ 'landing.how.step2.title' | transloco }}
          </h3>
          <p class="mt-2 text-base leading-relaxed text-text-muted">
            {{ 'landing.how.step2.body' | transloco }}
          </p>
        </li>
        <li>
          <span class="font-mono text-sm text-ib-blue">03</span>
          <h3 class="mt-3 text-xl font-semibold tracking-tight">
            {{ 'landing.how.step3.title' | transloco }}
          </h3>
          <p class="mt-2 text-base leading-relaxed text-text-muted">
            {{ 'landing.how.step3.body' | transloco }}
          </p>
        </li>
      </ol>

      <ul
        class="mt-12 flex flex-wrap items-center gap-x-8 gap-y-2 border-t border-border pt-8 font-mono text-xs tracking-tight text-text-muted"
      >
        <li class="flex items-center gap-2">
          <app-icon name="key" [size]="14" class="text-ib-blue" />
          <span>PBKDF2</span>
        </li>
        <li aria-hidden="true" class="text-border">·</li>
        <li>AES-256-GCM</li>
        <li aria-hidden="true" class="text-border">·</li>
        <li>{{ 'landing.how.envelope' | transloco }}</li>
        <li aria-hidden="true" class="text-border">·</li>
        <li class="flex items-center gap-2">
          <app-icon name="shield-check" [size]="14" class="text-ib-blue" />
          <span>{{ 'landing.how.zeroKnowledge' | transloco }}</span>
        </li>
      </ul>
    </section>
  `,
})
export class LandingSecurity {}
