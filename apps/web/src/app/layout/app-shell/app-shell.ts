import { Component, ChangeDetectionStrategy, inject, viewChild } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthStore } from '@features/auth/domain/auth.store';
import { Icon } from '@shared/components/icon/icon';
import { CommandPalette } from '@shared/components/command-palette/command-palette';
import { ToastContainer } from '@shared/components/toast/toast';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { ThemeStore } from '@core/services/theme.store';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex flex-col h-screen overflow-hidden' },
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, CommandPalette, ToastContainer, ConfirmDialog],
  template: `
    <header class="header">

      <a routerLink="/budget" class="logo-link" aria-label="Accueil DashFlow">
        <app-icon name="dashflow-logo" size="22" />
        <span>DashFlow</span>
      </a>

      <nav aria-label="Espaces" class="flex items-center bg-canvas p-1 rounded-lg border border-border">
        <a routerLink="/budget"
           routerLinkActive="tab--active-budget"
           class="tab">
          <app-icon name="wallet" size="15" /> Budget
        </a>
        <a routerLink="/medical"
           routerLinkActive="tab--active-medical"
           class="tab">
          <app-icon name="heart-pulse" size="15" /> Médical
        </a>
      </nav>

      <div class="flex items-center gap-2 shrink-0">
        <button type="button"
                class="header-btn hidden sm:inline-flex"
                (click)="commandPalette()?.open()">
          <app-icon name="search" size="14" />
          <span class="text-text-muted">Rechercher...</span>
          <kbd class="ml-3 rounded border border-border bg-elevated px-1.5 py-0.5 text-[10px] font-mono text-text-muted">⌘K</kbd>
        </button>

        <button type="button"
                class="icon-btn"
                (click)="theme.toggle()"
                [attr.aria-label]="theme.isDark() ? 'Passer en mode clair' : 'Passer en mode sombre'">
          <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" size="18" />
        </button>

        <a routerLink="/settings"
           class="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ib-blue"
           aria-label="Paramètres du compte">
          @if (auth.avatarUrl()) {
            <img [src]="auth.avatarUrl()" [alt]="auth.displayName()" class="w-8 h-8 rounded-full object-cover border border-border" />
          } @else {
            <div class="w-8 h-8 rounded-full bg-ib-purple border border-border flex items-center justify-center text-xs font-semibold text-white">
              {{ auth.userInitial() }}
            </div>
          }
        </a>
      </div>
    </header>

    <main class="flex-1 flex min-h-0">
      <router-outlet />
    </main>

    @defer (on idle) {
      <app-command-palette #cmdPalette />
      <app-toast-container />
      <app-confirm-dialog />
    }
  `,
  styles: `
    .logo-link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--text-primary);
      text-decoration: none;
      user-select: none;
      border-radius: 0.5rem;
      padding: 0.25rem 0.5rem;
      transition: opacity 150ms;
    }

    .logo-link:hover {
      opacity: 0.8;
    }

    .logo-link app-icon {
      color: var(--color-ib-cyan);
    }

    .header {
      height: 3.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-inline: 1.25rem;
      z-index: 10;
      flex-shrink: 0;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.375rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-muted);
      transition: color 150ms, background-color 150ms, box-shadow 150ms;
    }

    .tab:hover {
      color: var(--text-primary);
    }

    .header-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--bg-canvas);
      padding: 0.375rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color 150ms, color 150ms;
    }

    .header-btn:hover {
      border-color: var(--text-muted);
      color: var(--text-primary);
    }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--bg-canvas);
      color: var(--text-muted);
      cursor: pointer;
      transition: border-color 150ms, color 150ms, background-color 150ms;
    }

    .icon-btn:hover {
      border-color: var(--text-muted);
      color: var(--text-primary);
      background: var(--bg-hover);
    }
  `,
})
export class AppShell {
  protected readonly auth = inject(AuthStore);
  protected readonly theme = inject(ThemeStore);
  protected readonly commandPalette = viewChild<CommandPalette>('cmdPalette');
}
