import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';

const DEFAULT_RETURN_URL = '/budget';

function safeInternalUrl(url: string | undefined): string {
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return DEFAULT_RETURN_URL;
  }
  return url;
}

@Component({
  selector: 'app-upgrade',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full h-full overflow-y-auto' },
  imports: [RouterLink, TranslocoPipe, Icon],
  template: `
    <section
      aria-labelledby="upgrade-title"
      class="mx-auto max-w-xl px-6 py-12 flex flex-col items-center text-center"
    >
      <div
        class="flex h-14 w-14 items-center justify-center rounded-full bg-ib-yellow-10 text-ib-yellow mb-6"
      >
        <app-icon name="lock" size="24" />
      </div>

      <h2 id="upgrade-title" class="text-2xl font-bold text-text-primary tracking-tight">
        {{ 'entitlement.paywall.title' | transloco }}
      </h2>

      <p class="mt-3 text-sm text-text-muted">
        @if (reason() === 'limit') {
          {{ 'entitlement.paywall.limit' | transloco: { limit: limit() ?? '' } }}
        } @else {
          {{ 'entitlement.paywall.feature' | transloco: { feature: feature() ?? '' } }}
        }
      </p>

      <div class="mt-8 flex flex-col sm:flex-row items-center gap-3">
        <a
          routerLink="/settings"
          class="inline-flex items-center justify-center rounded-lg bg-ib-blue px-5 py-2.5 text-sm font-semibold text-canvas transition-colors hover:bg-ib-blue/90"
        >
          {{ 'entitlement.paywall.cta' | transloco }}
        </a>

        <a
          [routerLink]="safeReturnUrl()"
          class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
        >
          <app-icon name="arrow-left" size="14" />
          {{ 'entitlement.paywall.back' | transloco }}
        </a>
      </div>
    </section>
  `,
})
export class Upgrade {
  readonly feature = input<string>();
  readonly reason = input<string>();
  readonly limit = input<string>();
  readonly returnUrl = input<string>();

  protected readonly safeReturnUrl = computed(() => safeInternalUrl(this.returnUrl()));
}
