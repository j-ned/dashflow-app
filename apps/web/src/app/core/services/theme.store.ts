import { Injectable, signal, effect, computed, DestroyRef, inject } from '@angular/core';

export type ThemePreference = 'system' | 'dark' | 'light';
export type ResolvedTheme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const SYSTEM_QUERY = '(prefers-color-scheme: light)';

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'system';
}

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly _preference = signal<ThemePreference>(readStoredPreference());
  private readonly _systemTheme = signal<ResolvedTheme>(
    window.matchMedia(SYSTEM_QUERY).matches ? 'light' : 'dark',
  );

  readonly preference = this._preference.asReadonly();
  readonly resolved = computed<ResolvedTheme>(() => {
    const pref = this._preference();
    return pref === 'system' ? this._systemTheme() : pref;
  });
  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    const mql = window.matchMedia(SYSTEM_QUERY);
    const onSystemThemeChange = (e: MediaQueryListEvent) =>
      this._systemTheme.set(e.matches ? 'light' : 'dark');
    mql.addEventListener('change', onSystemThemeChange);
    inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', onSystemThemeChange));

    effect(() => {
      document.documentElement.setAttribute('data-theme', this.resolved());
    });
  }

  set(pref: ThemePreference): void {
    this._preference.set(pref);
    if (pref === 'system') {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, pref);
    }
  }

  toggle(): void {
    this.set(this.resolved() === 'dark' ? 'light' : 'dark');
  }
}
