import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { CryptoStore } from './crypto.store';

const MINUTES_KEY = 'dashflow.autoLockMinutes';
const ACTIVITY_KEY = 'dashflow.lastActivityAt';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
/** Écriture localStorage au plus toutes les 5 s : l'activité est fréquente, le stockage lent. */
const PERSIST_ACTIVITY_EVERY_MS = 5_000;

/** 0 = jamais. */
export const AUTO_LOCK_OPTIONS = [5, 15, 30, 60, 0] as const;
export const DEFAULT_AUTO_LOCK_MINUTES = 15;

function readMinutes(): number {
  try {
    const raw = localStorage.getItem(MINUTES_KEY);
    if (raw === null) return DEFAULT_AUTO_LOCK_MINUTES;
    const n = Number(raw);
    return (AUTO_LOCK_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_AUTO_LOCK_MINUTES;
  } catch {
    return DEFAULT_AUTO_LOCK_MINUTES;
  }
}

function readLastActivity(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Verrouille la clé maîtresse après N minutes sans interaction. La clé persiste en IndexedDB
 * pour survivre à un rechargement : sans ce garde-fou, un poste laissé ouvert exposait tout
 * pendant les 7 jours du cookie. L'horodatage de dernière activité est aussi persisté, pour
 * qu'un rechargement après une longue absence verrouille au lieu de restaurer.
 */
@Injectable({ providedIn: 'root' })
export class AutoLockStore {
  private readonly _crypto = inject(CryptoStore);
  private readonly _destroyRef = inject(DestroyRef);

  private readonly _minutes = signal(readMinutes());
  readonly minutes = this._minutes.asReadonly();

  /** Incrémenté à chaque verrouillage par inactivité : le shell navigue vers /auth/unlock. */
  private readonly _lockedAt = signal(0);
  readonly lockedAt = this._lockedAt.asReadonly();

  private _timer: ReturnType<typeof setTimeout> | undefined;
  private _lastActivity = readLastActivity() ?? Date.now();
  private _lastPersisted = 0;
  private _started = false;

  setMinutes(minutes: number): void {
    if (!(AUTO_LOCK_OPTIONS as readonly number[]).includes(minutes)) return;
    this._minutes.set(minutes);
    try {
      localStorage.setItem(MINUTES_KEY, String(minutes));
    } catch {
      /* stockage indisponible : le réglage vaut pour la session */
    }
    this._arm();
  }

  /** Vrai si la dernière activité connue remonte à plus que le délai (tenu à travers un rechargement). */
  isExpired(now = Date.now()): boolean {
    const minutes = this._minutes();
    if (minutes === 0) return false;
    const last = readLastActivity();
    if (last === null) return false;
    return now - last > minutes * 60_000;
  }

  /** À appeler une fois depuis le shell : écoute l'activité et arme le compte à rebours. */
  start(): void {
    if (this._started || typeof document === 'undefined') return;
    this._started = true;
    const onActivity = () => this.touch();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') this._checkExpiredNow();
    };
    for (const ev of ACTIVITY_EVENTS) {
      document.addEventListener(ev, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibility);
    this._destroyRef.onDestroy(() => {
      for (const ev of ACTIVITY_EVENTS) document.removeEventListener(ev, onActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      clearTimeout(this._timer);
    });
    this.touch();
  }

  /** Marque une activité : repousse le verrouillage. */
  touch(now = Date.now()): void {
    this._lastActivity = now;
    if (now - this._lastPersisted >= PERSIST_ACTIVITY_EVERY_MS) {
      this._lastPersisted = now;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(now));
      } catch {
        /* idem */
      }
    }
    this._arm();
  }

  private _arm(): void {
    clearTimeout(this._timer);
    const minutes = this._minutes();
    if (minutes === 0 || !this._started) return;
    const remaining = this._lastActivity + minutes * 60_000 - Date.now();
    this._timer = setTimeout(() => void this._fire(), Math.max(remaining, 0));
  }

  private _checkExpiredNow(): void {
    const minutes = this._minutes();
    if (minutes !== 0 && Date.now() - this._lastActivity > minutes * 60_000) void this._fire();
  }

  private async _fire(): Promise<void> {
    if (!this._crypto.isUnlocked()) return;
    await this._crypto.lock();
    this._lockedAt.update((n) => n + 1);
  }
}
