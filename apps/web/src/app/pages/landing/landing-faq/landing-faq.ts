import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-landing-faq',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section id="faq" class="mx-auto max-w-6xl px-6 py-24 lg:py-32" aria-labelledby="faq-title">
      <header class="max-w-3xl">
        <span
          class="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-text-muted"
        >
          <span aria-hidden="true" class="h-1.5 w-1.5 rounded-full bg-text-muted"></span>
          {{ 'landing.faq.eyebrow' | transloco }}
        </span>
        <h2 id="faq-title" class="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {{ 'landing.faq.title' | transloco }}
        </h2>
      </header>

      <dl class="mt-12 border-t border-border">
        @for (item of faqItems; track item.q) {
          <details class="group border-b border-border py-5">
            <summary
              class="flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-lg font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
            >
              <span>{{ item.q | transloco }}</span>
              <app-icon
                name="chevron-down"
                [size]="18"
                class="shrink-0 text-text-muted transition-transform group-open:rotate-180"
              />
            </summary>
            <p class="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              {{ item.a | transloco }}
            </p>
          </details>
        }
      </dl>
    </section>
  `,
})
export class LandingFaq {
  protected readonly faqItems = [
    { q: 'landing.faq.q1.question', a: 'landing.faq.q1.answer' },
    { q: 'landing.faq.q2.question', a: 'landing.faq.q2.answer' },
    { q: 'landing.faq.q3.question', a: 'landing.faq.q3.answer' },
    { q: 'landing.faq.q4.question', a: 'landing.faq.q4.answer' },
    { q: 'landing.faq.q5.question', a: 'landing.faq.q5.answer' },
  ];
}
