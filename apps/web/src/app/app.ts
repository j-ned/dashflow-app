import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ToastContainer } from '@shared/components/toast/toast';
import { ConfettiContainer } from '@shared/components/celebration/celebration';
import { AutoLockStore } from '@core/services/crypto/auto-lock.store';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastContainer, ConfettiContainer],
  templateUrl: './app.html',
  host: { class: 'contents' },
})
export class AppComponent {
  private readonly _autoLock = inject(AutoLockStore);
  private readonly _router = inject(Router);

  constructor() {
    this._autoLock.start();
    // Verrouillage par inactivité : on quitte l'écran courant (données déchiffrées à l'écran)
    // pour l'écran de déverrouillage, qui ramène ensuite à la page demandée.
    effect(() => {
      if (this._autoLock.lockedAt() > 0) {
        void this._router.navigate(['/auth/unlock'], {
          queryParams: { returnUrl: this._router.url, reason: 'inactivity' },
        });
      }
    });
  }
}
