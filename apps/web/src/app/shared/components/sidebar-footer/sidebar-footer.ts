import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-sidebar-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  host: { class: 'block mt-auto' },
  template: `
    <div class="border-t border-border p-4 space-y-1">
      <div class="flex items-center gap-3 px-3 py-2 mb-2">
        @if (auth.avatarUrl()) {
          <img [src]="auth.avatarUrl()" alt="" class="w-8 h-8 rounded-full object-cover border border-border" />
        } @else {
          <div class="w-8 h-8 rounded-full bg-ib-purple flex items-center justify-center text-xs font-semibold text-canvas">
            {{ auth.userInitial() }}
          </div>
        }
        <div class="min-w-0 flex-1">
          <p class="text-sm font-medium text-text-primary truncate">{{ auth.displayName() }}</p>
          <p class="text-xs text-text-muted truncate">{{ auth.email() }}</p>
        </div>
      </div>

      <a routerLink="/settings" routerLinkActive="bg-hover text-text-primary"
         class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-text-primary">
        <app-icon name="settings" size="16" />
        Paramètres
      </a>

      <button type="button" (click)="onLogout()"
              class="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-text-muted transition-colors hover:bg-hover hover:text-ib-red">
        <app-icon name="log-out" size="16" />
        Déconnexion
      </button>
    </div>
  `,
})
export class SidebarFooter {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected async onLogout() {
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
