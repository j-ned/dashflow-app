import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type LocalePreference = 'system' | 'fr' | 'en';
export type ResolvedLocale = 'fr' | 'en';

const STORAGE_KEY = 'locale';
const SUPPORTED: ResolvedLocale[] = ['fr', 'en'];
const DEFAULT_LOCALE: ResolvedLocale = 'fr';

function detectBrowserLocale(): ResolvedLocale {
  const lang = navigator.language?.slice(0, 2).toLowerCase();
  return SUPPORTED.includes(lang as ResolvedLocale) ? (lang as ResolvedLocale) : DEFAULT_LOCALE;
}

function readStoredPreference(): LocalePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'fr' || stored === 'en' || stored === 'system') return stored;
  return 'system';
}

@Injectable({ providedIn: 'root' })
export class LocaleStore {
  private readonly _transloco = inject(TranslocoService);
  private readonly _preference = signal<LocalePreference>(readStoredPreference());
  private readonly _systemLocale = signal<ResolvedLocale>(detectBrowserLocale());

  readonly preference = this._preference.asReadonly();
  readonly resolved = computed<ResolvedLocale>(() => {
    const pref = this._preference();
    return pref === 'system' ? this._systemLocale() : pref;
  });
  readonly isFrench = computed(() => this.resolved() === 'fr');

  constructor() {
    const onLanguageChange = () => this._systemLocale.set(detectBrowserLocale());
    window.addEventListener('languagechange', onLanguageChange);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('languagechange', onLanguageChange));

    effect(() => {
      const lang = this.resolved();
      this._transloco.setActiveLang(lang);
      document.documentElement.setAttribute('lang', lang);
    });
  }

  set(pref: LocalePreference): void {
    this._preference.set(pref);
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }

  toggle(): void {
    this.set(this.resolved() === 'fr' ? 'en' : 'fr');
  }
}
