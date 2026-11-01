import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'sidebar-collapsed';
/** Sous ce seuil (breakpoint `md` de Tailwind), le menu déplié mange l'écran : il reste en rail. */
const NARROW_QUERY = '(max-width: 767px)';

@Injectable({ providedIn: 'root' })
export class SidebarStore {
  private readonly _preference = signal(localStorage.getItem(STORAGE_KEY) === 'true');
  private readonly _narrow = signal(false);

  /** Écran étroit : le menu est forcé en rail et ne peut pas être déplié. */
  readonly narrow = this._narrow.asReadonly();
  readonly collapsed = computed(() => this._narrow() || this._preference());

  constructor() {
    if (typeof matchMedia !== 'function') return;
    const query = matchMedia(NARROW_QUERY);
    this._narrow.set(query.matches);
    query.addEventListener('change', (event) => this._narrow.set(event.matches));
  }

  toggle() {
    if (this._narrow()) return;
    const next = !this._preference();
    this._preference.set(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }
}
