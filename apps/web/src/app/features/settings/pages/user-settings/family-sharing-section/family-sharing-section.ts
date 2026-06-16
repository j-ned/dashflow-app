import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-family-sharing-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  // display:block (pas 'contents') : section en flux vertical de page — 'contents' annulerait les marges du host et casserait l'espacement du parent
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="family-sharing-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <h3 id="family-sharing-heading" class="text-base font-semibold text-text-primary">
          {{ 'settings.familySharing.title' | transloco }}
        </h3>
        <p class="text-sm text-text-muted mt-1">
          {{ 'settings.familySharing.subtitle' | transloco }}
        </p>
      </div>
      <div class="p-6">
        <button
          type="button"
          class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-4 py-2.5 text-sm font-medium text-canvas transition-colors hover:bg-ib-blue/90"
        >
          {{ 'settings.familySharing.invite' | transloco }}
        </button>
      </div>
    </section>
  `,
})
export class FamilySharingSection {}
