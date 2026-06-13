import { ChangeDetectionStrategy, Component } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-landing-medical-pillar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgOptimizedImage, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section id="medical" class="border-t border-border" aria-labelledby="medical-title">
      <div class="mx-auto max-w-6xl px-6 py-24 lg:py-32">
        <header class="max-w-3xl">
          <span
            class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-ib-purple"
          >
            <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-ib-purple"></span>
            {{ 'landing.medical.tag' | transloco }}
          </span>
          <h2 id="medical-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            {{ 'landing.medical.title' | transloco }}
          </h2>
          <p class="mt-4 text-lg leading-relaxed text-text-muted">
            {{ 'landing.medical.subtitle' | transloco }}
          </p>
        </header>

        <dl class="mt-12 grid gap-x-12 gap-y-8 border-t border-border pt-10 sm:grid-cols-2">
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
              {{ 'landing.medical.members.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.medical.members.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
              {{ 'landing.medical.appointments.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.medical.appointments.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
              {{ 'landing.medical.medications.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.medical.medications.description' | transloco }}
            </dd>
          </div>
          <div>
            <dt class="font-mono text-xs uppercase tracking-[0.16em] text-ib-purple">
              {{ 'landing.medical.documents.title' | transloco }}
            </dt>
            <dd class="mt-2 text-base leading-relaxed text-text-muted">
              {{ 'landing.medical.documents.description' | transloco }}
            </dd>
          </div>
        </dl>

        <figure
          class="mt-12 overflow-hidden rounded-lg border border-border bg-surface p-2 shadow-2xl shadow-black/40 lg:mt-16"
        >
          <img
            ngSrc="/screen/img_6.webp"
            [alt]="'landing.medical.screenshotAlt' | transloco"
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
export class LandingMedicalPillar {}
