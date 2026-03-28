import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-sidebar-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, Icon],
  host: { class: 'block mt-auto' },
  template: `
    <div class="border-t border-border p-2 space-y-0.5">

      @if (!collapsed()) {
        <!-- User info (expanded) -->
        <div class="flex items-center gap-3 px-3 py-2 mb-1">
          @if (auth.avatarUrl()) {
            <img [src]="auth.avatarUrl()" [alt]="auth.displayName()" class="w-8 h-8 rounded-full object-cover border border-border shrink-0" />
          } @else {
            <div class="w-8 h-8 rounded-full bg-ib-purple flex items-center justify-center text-xs font-semibold text-white shrink-0">
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
      } @else {
        <!-- Collapsed: icons only -->
        <div class="flex flex-col items-center gap-0.5">
          <div class="mb-1" title="{{ auth.displayName() }}">
            @if (auth.avatarUrl()) {
              <img [src]="auth.avatarUrl()" [alt]="auth.displayName()" class="w-8 h-8 rounded-full object-cover border border-border" />
            } @else {
              <div class="w-8 h-8 rounded-full bg-ib-purple flex items-center justify-center text-xs font-semibold text-white">
                {{ auth.userInitial() }}
              </div>
            }
          </div>

          <a routerLink="/settings" routerLinkActive="bg-hover text-text-primary"
             class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-text-primary"
             title="Paramètres">
            <app-icon name="settings" size="16" />
          </a>

          <button type="button" (click)="onLogout()"
                  class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-hover hover:text-ib-red"
                  title="Déconnexion">
            <app-icon name="log-out" size="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class SidebarFooter {
  protected readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  readonly collapsed = input(false);

  protected async onLogout() {
    await this.auth.logout();
    this.router.navigate(['/auth/login']);
  }
}
