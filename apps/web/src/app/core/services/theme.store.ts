import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';

@Injectable({ providedIn: 'root' })
export class ThemeStore {
  private readonly _theme = signal<Theme>(
    (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark',
  );

  readonly theme = this._theme.asReadonly();
  readonly isDark = () => this._theme() === 'dark';

  constructor() {
    // Apply theme class on <html> reactively
    effect(() => {
      const t = this._theme();
      document.documentElement.setAttribute('data-theme', t);
    });

    // Apply immediately on init
    document.documentElement.setAttribute('data-theme', this._theme());
  }

  toggle() {
    const next: Theme = this._theme() === 'dark' ? 'light' : 'dark';
    this._theme.set(next);
    localStorage.setItem(STORAGE_KEY, next);
  }
}
