import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Icon } from '@shared/components/icon/icon';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col h-screen overflow-hidden' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  template: `
    <header class="h-16 border-b border-border bg-surface flex items-center justify-between px-6 z-10 shrink-0">
      <div class="flex items-center gap-2">
        <span class="font-bold text-lg select-none">Dash Money</span>
      </div>

      <nav aria-label="Espaces" class="flex items-center bg-canvas p-1 rounded-lg border border-border">
        <a
          routerLink="/budget"
          routerLinkActive="bg-ib-green text-white font-medium shadow-sm"
          class="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors duration-150 ease-in-out text-text-muted hover:text-text-primary"
        >
          <app-icon name="wallet" size="16" /> Budget
        </a>
        <a
          routerLink="/freelance"
          routerLinkActive="bg-ib-blue text-white font-medium shadow-sm"
          class="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm transition-colors duration-150 ease-in-out text-text-muted hover:text-text-primary"
        >
          <app-icon name="briefcase" size="16" /> Freelance
        </a>
      </nav>

      <a routerLink="/settings" class="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
         aria-label="Paramètres du compte">
        @if (auth.avatarUrl()) {
          <img [src]="auth.avatarUrl()" alt="" class="w-8 h-8 rounded-full object-cover border border-border" />
        } @else {
          <div class="w-8 h-8 rounded-full bg-ib-purple border border-border flex items-center justify-center text-xs font-semibold text-canvas">
            {{ auth.userInitial() }}
          </div>
        }
      </a>
    </header>

    <main class="flex-1 flex min-h-0">
      <router-outlet />
    </main>
  `
})
export class AppShell {
  protected readonly auth = inject(AuthStore);
}
