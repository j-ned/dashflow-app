import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '@shared/components/icon/icon';
import { ThemeStore } from '@core/services/theme.store';
import { LocaleStore } from '@core/services/locale.store';

@Component({
  selector: 'app-locale-theme-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, TranslocoPipe],
  host: { class: 'inline-flex items-center gap-1' },
  template: `
    <button
      type="button"
      (click)="locale.toggle()"
      [attr.aria-label]="(locale.isFrench() ? 'locale.toEnglish' : 'locale.toFrench') | transloco"
      class="inline-flex min-h-11 items-center gap-2 rounded-md px-2.5 py-2 text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <span
        class="block h-3.5 w-5 overflow-hidden rounded-[2px] border border-border/60 leading-none"
        aria-hidden="true"
      >
        @if (locale.isFrench()) {
          <svg viewBox="0 0 3 2" class="block h-full w-full">
            <rect width="1" height="2" fill="#0055A4" />
            <rect x="1" width="1" height="2" fill="#ffffff" />
            <rect x="2" width="1" height="2" fill="#EF4135" />
          </svg>
        } @else {
          <svg viewBox="0 0 60 30" class="block h-full w-full">
            <clipPath id="locale-toggle-uk-mask">
              <path d="M30 15h30v15zv15H0zH0V0zV0h30z" />
            </clipPath>
            <path d="M0 0v30h60V0z" fill="#012169" />
            <path d="M0 0l60 30m0-30L0 30" stroke="#ffffff" stroke-width="6" />
            <path
              d="M0 0l60 30m0-30L0 30"
              clip-path="url(#locale-toggle-uk-mask)"
              stroke="#C8102E"
              stroke-width="4"
            />
            <path d="M30 0v30M0 15h60" stroke="#ffffff" stroke-width="10" />
            <path d="M30 0v30M0 15h60" stroke="#C8102E" stroke-width="6" />
          </svg>
        }
      </span>
      <span class="font-mono text-xs font-medium tracking-tight">{{
        locale.isFrench() ? 'FR' : 'EN'
      }}</span>
    </button>
    <button
      type="button"
      (click)="theme.toggle()"
      [attr.aria-label]="(theme.isDark() ? 'theme.toLight' : 'theme.toDark') | transloco"
      class="inline-flex min-h-11 items-center justify-center rounded-md px-2.5 py-2 text-text-muted transition-colors hover:bg-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="18" />
    </button>
  `,
})
export class LocaleThemeToggle {
  protected readonly theme = inject(ThemeStore);
  protected readonly locale = inject(LocaleStore);
}
