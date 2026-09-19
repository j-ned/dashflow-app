import { Injectable, signal } from '@angular/core';

const KEY_PREFIX = 'dashflow.balanceCheckedAt.';

function read(accountId: string): number | null {
  try {
    const n = Number(localStorage.getItem(KEY_PREFIX + accountId));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * Date de la dernière fois où le solde d'un compte a été comparé à celui de la banque. Simple
 * confort local, par appareil : perdre cette date ne fait que reproposer la vérification.
 */
@Injectable({ providedIn: 'root' })
export class BalanceCheckStore {
  private readonly _checkedAt = signal<Readonly<Record<string, number | null>>>({});

  checkedAt(accountId: string): number | null {
    const known = this._checkedAt();
    return accountId in known ? known[accountId] : read(accountId);
  }

  markChecked(accountId: string, now = Date.now()): void {
    this._checkedAt.update((m) => ({ ...m, [accountId]: now }));
    try {
      localStorage.setItem(KEY_PREFIX + accountId, String(now));
    } catch {
      /* stockage indisponible : la vérification sera reproposée, sans autre effet */
    }
  }
}
