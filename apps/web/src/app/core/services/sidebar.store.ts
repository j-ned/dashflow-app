import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'sidebar-collapsed';

@Injectable({ providedIn: 'root' })
export class SidebarStore {
  private readonly _collapsed = signal(localStorage.getItem(STORAGE_KEY) === 'true');
  readonly collapsed = this._collapsed.asReadonly();

  toggle() {
    const next = !this._collapsed();
    this._collapsed.set(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  }
}
