import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '@features/auth/auth.store';
import {
  ATTENTION_EVENT_TYPES,
  SECURITY_EVENT_TYPES,
  SecurityEvent,
} from '@features/auth/domain/models/security-event.model';
import { summarizeUserAgent } from '@features/auth/domain/user-agent-summary';

type Row = {
  readonly id: string;
  readonly label: string;
  readonly when: string;
  readonly where: string;
  readonly attention: boolean;
};

const KNOWN_TYPES: ReadonlySet<string> = new Set(SECURITY_EVENT_TYPES);

@Component({
  selector: 'app-security-activity-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  host: { class: 'block' },
  template: `
    <section
      aria-labelledby="activity-heading"
      class="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden mb-8"
    >
      <div class="px-6 py-5 border-b border-border bg-surface/50">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h3 id="activity-heading" class="text-base font-semibold text-text-primary">
              {{ 'settings.activity.title' | transloco }}
            </h3>
            <p class="text-sm text-text-muted mt-1">
              {{ 'settings.activity.subtitle' | transloco }}
            </p>
          </div>
          <button
            type="button"
            (click)="reload()"
            [disabled]="loading()"
            class="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-text-primary transition-colors hover:bg-raised disabled:opacity-50"
          >
            {{ 'settings.activity.refresh' | transloco }}
          </button>
        </div>
      </div>

      <div class="p-6">
        @if (error()) {
          <p role="alert" class="text-sm text-ib-red">
            {{ 'settings.activity.error' | transloco }}
          </p>
        } @else if (!loading() && rows().length === 0) {
          <p class="text-sm text-text-muted">{{ 'settings.activity.empty' | transloco }}</p>
        } @else {
          <ol class="divide-y divide-border/60" data-testid="security-activity-list">
            @for (row of rows(); track row.id) {
              <li class="flex items-start gap-3 py-3">
                <span
                  class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
                  [class.bg-ib-orange]="row.attention"
                  [class.bg-ib-green]="!row.attention"
                  aria-hidden="true"
                ></span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm text-text-primary">{{ row.label }}</p>
                  <p class="text-xs text-text-muted">
                    {{ row.when }}
                    @if (row.where) {
                      <span> · {{ row.where }}</span>
                    }
                  </p>
                </div>
              </li>
            }
          </ol>
        }
      </div>
    </section>
  `,
})
export class SecurityActivitySection {
  private readonly auth = inject(AuthStore);
  private readonly _i18n = inject(TranslocoService);

  private readonly events = signal<SecurityEvent[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected readonly rows = computed<Row[]>(() =>
    this.events().map((e) => ({
      id: e.id,
      label: this._i18n.translate(
        KNOWN_TYPES.has(e.type)
          ? `settings.activity.types.${e.type}`
          : 'settings.activity.types.unknown',
      ),
      when: formatWhen(e.at, this._i18n.getActiveLang()),
      where: [summarizeUserAgent(e.userAgent), e.ip].filter(Boolean).join(' · '),
      attention: ATTENTION_EVENT_TYPES.has(e.type),
    })),
  );

  constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(false);
    try {
      this.events.set(await this.auth.securityEvents(30));
    } catch {
      this.error.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}

/** « il y a 3 h » sous 7 jours, sinon la date complète. */
export function formatWhen(iso: string, lang: string, now = new Date()): string {
  const date = new Date(iso);
  const diffMs = date.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (abs < 60_000) return rtf.format(0, 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
  if (abs < 7 * 86_400_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');
  return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
