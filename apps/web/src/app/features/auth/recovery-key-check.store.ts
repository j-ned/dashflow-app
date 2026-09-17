import { Injectable, signal } from '@angular/core';

const KEY_PREFIX = 'dashflow.recoveryKeyCheckedAt.';
const DAY_MS = 86_400_000;
/** Au-delà, on redemande à l'utilisateur s'il a toujours sa clé de récupération. */
export const RECOVERY_CHECK_EVERY_DAYS = 90;

function read(userId: string): number | null {
  try {
    const n = Number(localStorage.getItem(KEY_PREFIX + userId));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Date de la dernière preuve que l'utilisateur possède une clé de récupération valide (il l'a
 * vérifiée, ou vient d'en générer une). Simple confort local, par appareil : perdre cette date
 * ne fait que réafficher le rappel.
 */
@Injectable({ providedIn: 'root' })
export class RecoveryKeyCheckStore {
  private readonly _checkedAt = signal<number | null>(null);
  private _userId: string | null = null;

  forUser(userId: string): void {
    if (userId === this._userId) return;
    this._userId = userId;
    this._checkedAt.set(read(userId));
  }

  isDue(now = Date.now()): boolean {
    const checkedAt = this._checkedAt();
    return checkedAt === null || now - checkedAt > RECOVERY_CHECK_EVERY_DAYS * DAY_MS;
  }

  markChecked(now = Date.now()): void {
    this._checkedAt.set(now);
    if (!this._userId) return;
    try {
      localStorage.setItem(KEY_PREFIX + this._userId, String(now));
    } catch {
      /* stockage indisponible : le rappel réapparaîtra, sans autre effet */
    }
  }
}
